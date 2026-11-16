import type { Express } from "express";
import multer from "multer";
import type { Db } from "../db";
import { CATEGORIAS_DOCUMENTO, MAX_DOCUMENTO } from "../../shared/documentos";
import { apagarDocumento, caminhoDocumento, inspecionarDocumento, nomeDoUpload, nomeSeguro, novoNomeArquivo, salvarDocumento } from "../lib/documentos";

const COLUNAS = "id, fazenda_id, nome, categoria, descricao, tamanho, criado_em";

/** Documentos privados da fazenda: só administrador, nunca públicos. */
export function registrarRotasDocumentos(app: Express, db: Db, exigirAdmin: any, dir: string | undefined) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DOCUMENTO, files: 1, fields: 4, fieldSize: 2000, parts: 6 } });
  const semPasta = (res: any) => res.status(503).json({ message: "A pasta de documentos não está configurada (DOCUMENTOS_DIR)." });
  const idDe = (v: unknown) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : 0; };

  app.get("/api/admin/fazendas/:id/documentos", exigirAdmin, async (req, res, next) => {
    try {
      const id = idDe(req.params.id); if (!id) return res.status(400).json({ message: "Identificador inválido." });
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ documentos: (await db.query(`SELECT ${COLUNAS} FROM fazenda_documentos WHERE fazenda_id=$1 ORDER BY categoria, criado_em DESC, id DESC`, [id])).rows });
    } catch (e) { next(e); }
  });

  app.post("/api/admin/fazendas/:id/documentos", exigirAdmin, upload.single("arquivo"), async (req, res, next) => {
    try {
      if (!dir) return semPasta(res);
      const id = idDe(req.params.id); if (!id) return res.status(400).json({ message: "Identificador inválido." });
      if (!(await db.query("SELECT 1 FROM fazendas WHERE id=$1", [id])).rowCount) return res.status(404).json({ message: "Fazenda não encontrada." });
      const categoria = typeof req.body?.categoria === "string" ? req.body.categoria : "";
      if (!(CATEGORIAS_DOCUMENTO as readonly string[]).includes(categoria)) return res.status(400).json({ message: "Escolha o tipo do documento." });
      const descricao = typeof req.body?.descricao === "string" ? req.body.descricao.trim().slice(0, 300) : "";
      if (!req.file || !req.file.size) return res.status(400).json({ message: "Escolha um arquivo PDF, JPEG ou PNG." });
      const original = nomeDoUpload(req.file.originalname);
      const r = inspecionarDocumento(req.file.buffer, original);
      if (!r.ok) return res.status(415).json({ message: r.erro });
      const arquivo = novoNomeArquivo(r.ext);
      await salvarDocumento(dir, arquivo, r.dados);
      try {
        const ins = await db.query(`INSERT INTO fazenda_documentos (fazenda_id, arquivo, nome, mime, categoria, descricao, tamanho) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COLUNAS}`,
          [id, arquivo, nomeSeguro(original, r.ext), r.mime, categoria, descricao, r.dados.length]);
        res.status(201).json(ins.rows[0]);
      } catch (e) { await apagarDocumento(dir, arquivo); throw e; }
    } catch (e) { next(e); }
  });

  app.get("/api/admin/documentos/:docId/baixar", exigirAdmin, async (req, res, next) => {
    try {
      if (!dir) return semPasta(res);
      const d = (await db.query("SELECT * FROM fazenda_documentos WHERE id=$1", [idDe(req.params.docId)])).rows[0];
      const caminho = d ? caminhoDocumento(dir, d.arquivo) : null;
      if (!d || !caminho) return res.status(404).json({ message: "Documento não encontrado." });
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Cache-Control", "private, no-store"); res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.type(d.mime);
      res.download(caminho, d.nome, (err) => { if (err && !res.headersSent) res.status(404).json({ message: "Arquivo indisponível." }); });
    } catch (e) { next(e); }
  });

  app.delete("/api/admin/documentos/:docId", exigirAdmin, async (req, res, next) => {
    try {
      const r = await db.query("DELETE FROM fazenda_documentos WHERE id=$1 RETURNING arquivo", [idDe(req.params.docId)]);
      if (!r.rowCount) return res.status(404).json({ message: "Documento não encontrado." });
      // O registro sai primeiro: mesmo se o disco falhar, o arquivo deixa de ser listado.
      if (dir) await apagarDocumento(dir, r.rows[0].arquivo);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
}
