import type { Express } from "express";
import rateLimit from "express-rate-limit";
import type { Db } from "../db";
import { lerConfig } from "../config";
import { listarPublicas, obterPublicaPorSlug, opcoesFiltros, type FiltrosPublicos } from "../lib/publico";
import { limparTelefone, validarEmail } from "../auth";

const num = (v: unknown): number | undefined => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};
const txt = (v: unknown, max = 100): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export function registrarRotasPublicas(app: Express, db: Db, opts: { limitar: boolean }) {
  const limiteContato = opts.limitar
    ? rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: "Muitos envios. Tente novamente em alguns minutos." } })
    : (_req: any, _res: any, next: any) => next();

  app.get("/api/public/config", async (_req, res) => {
    const c = await lerConfig(db);
    res.json({
      nome_site: c.nome_site, whatsapp_padrao: c.whatsapp_padrao, texto_creci: c.texto_creci,
      aviso_intermediacao: c.aviso_intermediacao, hero_titulo: c.hero_titulo, hero_subtitulo: c.hero_subtitulo,
      modulo_pesquisa_ativo: c.modulo_pesquisa_ativo,
      sobre_titulo: c.sobre_titulo, sobre_texto: c.sobre_texto, contato_email: c.contato_email,
      contato_endereco: c.contato_endereco, contato_horario: c.contato_horario, instagram_url: c.instagram_url,
    });
  });

  app.get("/api/public/parceiros", async (_req, res) => {
    const r = await db.query("SELECT id, nome, arquivo, url FROM parceiros WHERE ativo ORDER BY ordem, id");
    res.json({ parceiros: r.rows.map((x: any) => ({ id: x.id, nome: x.nome, logo: x.arquivo ? `/uploads/${x.arquivo}` : null, url: x.url })) });
  });

  app.get("/api/public/home", async (_req, res) => {
    const c = await lerConfig(db);
    const s = await db.query(
      `SELECT s.id, s.titulo, s.subtitulo, s.arquivo, s.link_tipo, s.url, f.slug AS fazenda_slug
         FROM slides s LEFT JOIN fazendas f ON f.id = s.fazenda_id AND f.status = 'publicada'
        WHERE s.ativo ORDER BY s.ordem, s.id`,
    );
    const slides = s.rows.map((x: any) => ({
      id: x.id, titulo: x.titulo, subtitulo: x.subtitulo, imagem: x.arquivo ? `/uploads/${x.arquivo}` : null,
      link: x.link_tipo === "fazenda" && x.fazenda_slug ? `/fazenda/${x.fazenda_slug}` : x.link_tipo === "url" ? x.url : null,
    }));
    const d = await db.query(`SELECT slug FROM fazendas WHERE status='publicada' AND destaque ORDER BY destaque_ordem, publicado_em DESC NULLS LAST LIMIT 6`);
    const todos = await listarPublicas(db, { limite: 60 }, c.whatsapp_padrao);
    const slugs = new Set(d.rows.map((x: any) => x.slug));
    res.json({ slides, destaques: todos.fazendas.filter((f) => slugs.has(f.slug)) });
  });

  app.get("/api/public/filtros", async (_req, res) => res.json(await opcoesFiltros(db)));

  app.get("/api/public/fazendas", async (req, res) => {
    const q = req.query;
    const filtros: FiltrosPublicos = {
      regiao: txt(q.regiao), cultura: txt(q.cultura, 60),
      area_min: num(q.area_min), area_max: num(q.area_max),
      altitude_min: num(q.altitude_min), altitude_max: num(q.altitude_max),
      argila_min: num(q.argila_min), argila_max: num(q.argila_max),
      relevo: txt(q.relevo, 20), com_agua: q.com_agua === "1", com_energia: q.com_energia === "1", ordem: txt(q.ordem, 20),
      limite: num(q.limite), deslocamento: num(q.deslocamento),
    };
    const c = await lerConfig(db);
    res.json(await listarPublicas(db, filtros, c.whatsapp_padrao));
  });

  app.get("/api/public/fazendas/:slug", async (req, res) => {
    const c = await lerConfig(db);
    const f = await obterPublicaPorSlug(db, String(req.params.slug), c.whatsapp_padrao);
    if (!f) return res.status(404).json({ message: "Fazenda não encontrada." });
    res.json(f);
  });

  app.post("/api/public/contato", limiteContato, async (req, res) => {
    const b = req.body ?? {};
    if (typeof b.website === "string" && b.website.length > 0) return res.json({ ok: true }); // isca anti-robô
    const nome = txt(b.nome, 120);
    const tel = limparTelefone(b.whatsapp);
    const email = b.email ? validarEmail(b.email) : null;
    if (!nome || nome.length < 2) return res.status(400).json({ message: "Informe seu nome." });
    if (!tel) return res.status(400).json({ message: "Informe um WhatsApp válido com DDD." });
    if (b.email && !email) return res.status(400).json({ message: "E-mail inválido." });
    let fazendaId: number | null = null;
    if (typeof b.fazenda_slug === "string") {
      const f = await db.query<{ id: number }>("SELECT id FROM fazendas WHERE slug = $1 AND status = 'publicada'", [b.fazenda_slug]);
      if (!f.rows[0]) return res.status(404).json({ message: "Fazenda não encontrada." });
      fazendaId = f.rows[0].id;
    }
    // Origem: vitrine (de uma fazenda), contato (página Contato) ou anuncio (quer vender). O anúncio guarda os dados da fazenda na mensagem.
    const origem = fazendaId ? "vitrine" : b.tipo === "anuncio" ? "anuncio" : "contato";
    let mensagem = txt(b.mensagem, 1000) ?? "";
    if (origem === "anuncio") {
      const extra = [
        txt(b.regiao_fazenda, 120) && `Região/município: ${txt(b.regiao_fazenda, 120)}`,
        txt(b.area_fazenda, 40) && `Área aproximada: ${txt(b.area_fazenda, 40)}`,
        txt(b.car_fazenda, 60) && `CAR: ${txt(b.car_fazenda, 60)}`,
        txt(b.culturas_fazenda, 120) && `Culturas: ${txt(b.culturas_fazenda, 120)}`,
      ].filter(Boolean).join("\n");
      mensagem = [extra, mensagem].filter(Boolean).join("\n");
    }
    await db.query(
      `INSERT INTO contatos (fazenda_id, usuario_id, nome, whatsapp, email, mensagem, origem) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [fazendaId, (req as any).usuario?.id ?? null, nome, tel, email, mensagem || null, origem],
    );
    res.status(201).json({ ok: true });
  });
}
