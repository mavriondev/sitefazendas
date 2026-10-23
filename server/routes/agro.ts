import type { Express } from "express";
import type { Db } from "../db";
import { CONFIG_AGRO_PADRAO, WIDGETS_AGRO, type ConfigAgro } from "../../shared/agro";
import { atualizarAgro, configAgro, dolarAgro, estadoVazio, fontesAtivas, gravarValorAgro, lerValorAgro, noticiaPublica } from "../lib/agro";
import type { BuscarAgro } from "../lib/agro-fontes";

export function registrarRotasAgro(app: Express, db: Db, opts: { automatico: boolean; buscar?: BuscarAgro }) {
  const atualizarEmSegundoPlano = () => {
    if (opts.automatico) void atualizarAgro(db, opts.buscar).catch(() => { /* Não expor erros SQL nem mensagens externas. */ });
  };
  app.get("/api/public/agro", async (_req, res) => {
    atualizarEmSegundoPlano();
    const config = await configAgro(db);
    res.json({ config, dolar: config.cotacoes_ativas ? await dolarAgro(db) : null,
      estado: await lerValorAgro(db, "agro_estado", estadoVazio) });
  });
  app.get("/api/public/noticias", async (req, res) => {
    const pagina = req.query.pagina === undefined ? 1 : Number(req.query.pagina);
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10000) return res.status(400).json({ message: "Página inválida." });
    atualizarEmSegundoPlano();
    const fontes = fontesAtivas(await configAgro(db));
    const total = Number((await db.query<{ total: string }>("SELECT count(*) AS total FROM site_noticias WHERE ativo AND fonte=ANY($1::text[])", [fontes])).rows[0].total);
    const r = await db.query("SELECT * FROM site_noticias WHERE ativo AND fonte=ANY($1::text[]) ORDER BY ordem, publicado_em DESC NULLS LAST, id DESC LIMIT 12 OFFSET $2", [fontes, (pagina - 1) * 12]);
    res.json({ noticias: r.rows.map(noticiaPublica), pagina, total, paginas: Math.ceil(total / 12) });
  });
  app.get("/api/public/noticias/:slug", async (req, res) => {
    if (!/^[a-z0-9-]{1,160}$/.test(req.params.slug)) return res.status(404).json({ message: "Notícia não encontrada." });
    const r = await db.query("SELECT * FROM site_noticias WHERE slug=$1 AND ativo AND fonte=ANY($2::text[])", [req.params.slug, fontesAtivas(await configAgro(db))]);
    if (!r.rows.length) return res.status(404).json({ message: "Notícia não encontrada." });
    res.json({ noticia: noticiaPublica(r.rows[0]) });
  });
  app.get("/api/admin/agro", async (_req, res) => {
    const r = await db.query("SELECT * FROM site_noticias ORDER BY ordem, publicado_em DESC NULLS LAST, id DESC LIMIT 100");
    res.json({ config: await configAgro(db), dolar: await dolarAgro(db), noticias: r.rows.map(noticiaPublica),
      estado: await lerValorAgro(db, "agro_estado", estadoVazio) });
  });
  app.put("/api/admin/agro", async (req, res) => {
    const keys = Object.keys(CONFIG_AGRO_PADRAO);
    if (!req.body || Object.keys(req.body).length !== keys.length || !keys.every(k => typeof req.body[k] === "boolean")) {
      return res.status(400).json({ message: "Informe as quatro opções de notícias e cotações." });
    }
    const config = Object.fromEntries(keys.map(k => [k, req.body[k]])) as unknown as ConfigAgro;
    await gravarValorAgro(db, "agro_config", config);
    res.json({ config });
  });
  app.post("/api/admin/agro/atualizar", async (_req, res) => {
    res.json({ estado: await atualizarAgro(db, opts.buscar, true) });
  });
  app.put("/api/admin/noticias/:id", async (req, res) => {
    const b = req.body;
    if (!b || Object.keys(b).some(k => !["chamada", "resumo", "ativo", "ordem"].includes(k)) ||
      typeof b.chamada !== "string" || b.chamada.length > 250 || typeof b.resumo !== "string" || b.resumo.length > 2000 ||
      typeof b.ativo !== "boolean" || !Number.isInteger(b.ordem) || b.ordem < 0 || b.ordem > 9999 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(b.chamada + b.resumo)) return res.status(400).json({ message: "Revise os campos da notícia." });
    const r = await db.query("UPDATE site_noticias SET chamada=$2,resumo=$3,ativo=$4,ordem=$5 WHERE id=$1 RETURNING *", [req.params.id, b.chamada.trim(), b.resumo.trim(), b.ativo, b.ordem]);
    if (!r.rows.length) return res.status(404).json({ message: "Notícia não encontrada." });
    res.json({ noticia: noticiaPublica(r.rows[0]) });
  });
  app.get("/mercado-widget/:widget", async (req, res) => {
    const widget = WIDGETS_AGRO.find(w => w.id === req.params.widget);
    if (!widget || !(await configAgro(db)).cotacoes_ativas) return res.status(404).type("text").send("Cotação indisponível.");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    // Documento independente e sandboxed; nunca executa scripts do provedor
    // no documento principal. Nenhum domínio de publicidade é autorizado.
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src https://www.noticiasagricolas.com.br/widgets/cotacoes; style-src 'unsafe-inline'; img-src https://www.noticiasagricolas.com.br https://cdn.noticiasagricolas.com.br data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox");
    const url = "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=" + widget.id +
      "&fonte=Arial&tamanho=10pt&largura=auto&cortexto=27452c&corcabecalho=edf2e8&corlinha=f8faf5&imagem=false&output=js";
    res.type("html").send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${widget.nome} — Notícias Agrícolas</title><style>body{margin:0;padding:8px;font:14px Arial;color:#27452c}table{max-width:100%!important;width:100%!important}a{color:#27452c}img{max-width:100%}</style><body><script src="${url.replace(/&/g, "&amp;")}"></script><noscript>Ative o JavaScript para carregar as cotações do provedor.</noscript></body></html>`);
  });
}
