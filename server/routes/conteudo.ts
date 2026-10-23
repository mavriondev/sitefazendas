import type { Express } from "express";
import multer from "multer";
import crypto from "node:crypto";
import type { Db } from "../db";
import { lerConteudo, validarConteudo, imagensDoConteudo } from "../lib/conteudo";
import { sanitizarImagem } from "../lib/foto";
import { salvarArquivo, apagarArquivo } from "../lib/arquivos";
import type { ConteudoSite } from "../../shared/conteudo";

export function registrarRotasConteudo(app: Express, db: Db, uploadsDir: string) {
  // /api/admin é protegido antes do parser no criarApp; CSRF também vale aqui.
  app.get("/api/public/conteudo", async (_req, res) => res.json(await lerConteudo(db)));
  app.get("/api/admin/conteudo", async (_req, res) => res.json(await lerConteudo(db)));
  app.put("/api/admin/conteudo", async (req, res) => {
    const erro = validarConteudo(req.body);
    if (erro) return res.status(400).json({ message: erro });
    const b = req.body as ConteudoSite;
    const imagens = imagensDoConteudo(b);
    if (imagens.length) {
      const existentes = await db.query<{ arquivo: string }>("SELECT arquivo FROM site_midias WHERE arquivo=ANY($1::text[])", [imagens]);
      if (existentes.rows.length !== imagens.length) return res.status(400).json({ message: "Uma imagem não está mais na biblioteca. Envie ou selecione novamente." });
    }
    const novo = { ...b, revisao: b.revisao + 1 };
    // Revisão e visibilidade da mídia são atualizadas atomicamente.
    const salvo = await db.query<{ valor: ConteudoSite }>(`
      WITH referencias AS MATERIALIZED (
        SELECT arquivo FROM site_midias WHERE arquivo=ANY($3::text[]) ORDER BY arquivo FOR UPDATE
      ), salvo AS (
        INSERT INTO configuracoes (chave,valor) SELECT 'conteudo_site',$2::jsonb
        WHERE (SELECT count(*) FROM referencias)=cardinality($3::text[]) AND ($1::bigint=0 OR EXISTS (
          SELECT 1 FROM configuracoes WHERE chave='conteudo_site' AND (valor->>'revisao')::bigint=$1
        ))
        ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor,atualizado_em=now()
        WHERE (configuracoes.valor->>'revisao')::bigint=$1
        RETURNING valor
      ), midias AS (
        UPDATE site_midias SET publicado=(arquivo=ANY($3::text[])) WHERE EXISTS (SELECT 1 FROM salvo) RETURNING arquivo
      ) SELECT valor FROM salvo`, [b.revisao, JSON.stringify(novo), imagens]);
    if (!salvo.rowCount) return res.status(409).json({ message: "O conteúdo foi alterado em outra sessão. Recarregue antes de salvar para não sobrescrever as alterações." });
    res.json(salvo.rows[0].valor);
  });

  app.get("/api/admin/conteudo/midias", async (_req, res) => {
    const r = await db.query("SELECT arquivo,publicado,criado_em FROM site_midias ORDER BY criado_em DESC LIMIT 200");
    res.json({ midias: r.rows.map(m => ({ ...m, url: `/uploads/${m.arquivo}` })) });
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });
  app.post("/api/admin/conteudo/midias", upload.single("arquivo"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Selecione uma imagem JPEG ou PNG." });
    const imagem = sanitizarImagem(req.file.buffer);
    if (!imagem) return res.status(400).json({ message: "O conteúdo do arquivo não é uma imagem JPEG ou PNG válida." });
    const arquivo = `${crypto.randomBytes(16).toString("hex")}.${imagem.tipo === "jpeg" ? "jpg" : "png"}`;
    await salvarArquivo(uploadsDir, arquivo, imagem.dados);
    try { await db.query("INSERT INTO site_midias (arquivo) VALUES ($1)", [arquivo]); }
    catch (e) { await apagarArquivo(uploadsDir, arquivo); throw e; }
    res.status(201).json({ arquivo, url: `/uploads/${arquivo}`, publicado: false });
  });
  app.delete("/api/admin/conteudo/midias/:arquivo", async (req, res) => {
    const arquivo = String(req.params.arquivo);
    if (!/^[a-f0-9]{32}\.(jpg|png)$/.test(arquivo)) return res.status(400).json({ message: "Arquivo inválido." });
    const r = await db.query("DELETE FROM site_midias WHERE arquivo=$1 AND NOT publicado RETURNING arquivo", [arquivo]);
    if (!r.rowCount) {
      const existe = await db.query("SELECT 1 FROM site_midias WHERE arquivo=$1", [arquivo]);
      return res.status(existe.rowCount ? 409 : 404).json({ message: existe.rowCount ? "Esta imagem está em uso. Substitua-a nas páginas e salve antes de excluir." : "Imagem não encontrada." });
    }
    await apagarArquivo(uploadsDir, arquivo);
    res.json({ ok: true });
  });
}
