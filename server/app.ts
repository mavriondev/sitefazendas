import express, { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import type { Db } from "./db";
import { middlewaresDeAuth } from "./auth";
import { registrarRotasAuth } from "./routes/auth";
import { registrarRotasPublicas } from "./routes/public";
import { registrarRotasAdmin } from "./routes/admin";
import { registrarRotasPesquisa } from "./routes/pesquisa";
import { lerConfig } from "./config";
import { obterPublicaPorSlug } from "./lib/publico";
import type { Hub } from "./lib/hub";
import { arquivoInexistente, armazenamentoPersistenteAtivo, buscarArquivo } from "./lib/arquivos";

export interface OpcoesApp {
  db: Db;
  uploadsDir: string;
  segredo: string;
  producao: boolean;
  /** Limites de tentativas (login/cadastro/contato). Desligue só em testes. */
  limitar: boolean;
  sessionStore?: session.Store;
  hub?: Hub;
  fetchIA?: typeof fetch;
  /** Pasta do front-end compilado (dist/public). */
  clientDir?: string;
  siteUrl?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function criarApp(o: OpcoesApp): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "img-src": ["'self'", "data:", "https://tile.openstreetmap.org"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "script-src": ["'self'"],
        "connect-src": ["'self'"],
        "upgrade-insecure-requests": o.producao ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  }));
  app.use(express.json({ limit: "5mb" }));
  app.use(session({
    store: o.sessionStore,
    secret: o.segredo,
    name: "sf.sid",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: o.producao, maxAge: 1000 * 60 * 60 * 24 * 14 },
  }));
  const { anexar, exigirLogin, exigirAdmin } = middlewaresDeAuth(o.db);
  app.use(anexar);

  app.get("/api/saude", (_req, res) => res.json({ ok: true }));
  registrarRotasAuth(app, o.db, { limitar: o.limitar });
  registrarRotasPublicas(app, o.db, { limitar: o.limitar });
  registrarRotasAdmin(app, o.db, exigirAdmin, { uploadsDir: o.uploadsDir, hub: o.hub, fetchIA: o.fetchIA });
  registrarRotasPesquisa(app, o.db, exigirLogin, { hub: o.hub, segredo: o.segredo });


  // robots.txt e sitemap.xml (só fazendas publicadas). Painel e API ficam fora dos buscadores.
  const baseDe = (req: Request) => (o.siteUrl || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /entrar\nDisallow: /cadastro\nDisallow: /redefinir-senha\nSitemap: ${baseDe(req)}/sitemap.xml\n`);
  });
  app.get("/sitemap.xml", async (req, res, next) => {
    try {
      const base = baseDe(req);
      const r = await o.db.query<{ slug: string; atualizado_em: string }>("SELECT slug, atualizado_em FROM fazendas WHERE status='publicada' ORDER BY id");
      const urls = [`<url><loc>${esc(base)}/</loc></url>`, `<url><loc>${esc(base)}/fazendas</loc></url>`,
        ...r.rows.map((x) => `<url><loc>${esc(`${base}/fazenda/${x.slug}`)}</loc><lastmod>${new Date(x.atualizado_em).toISOString().slice(0, 10)}</lastmod></url>`)];
      res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
    } catch (e) { next(e); }
  });
  app.use(["/admin", "/redefinir-senha"], (_req, res, next) => { res.setHeader("X-Robots-Tag", "noindex, nofollow"); next(); });

  if (armazenamentoPersistenteAtivo()) {
    app.get("/uploads/:arquivo", async (req, res, next) => {
      try {
        const nome = String(req.params.arquivo);
        if (!/^[a-f0-9]{32}\.(jpg|png)$/.test(nome)) return res.status(404).end();
        const publico = await o.db.query<{ publico: boolean }>(
          `SELECT
             EXISTS (SELECT 1 FROM fazenda_fotos p JOIN fazendas f ON f.id=p.fazenda_id
                     WHERE p.arquivo=$1 AND f.status='publicada')
             OR EXISTS (SELECT 1 FROM slides s WHERE s.arquivo=$1 AND s.ativo) AS publico`,
          [nome],
        );
        if (!publico.rows[0]?.publico && (req as any).usuario?.papel !== "admin") {
          return res.status(404).end();
        }
        const arquivo = await buscarArquivo(nome);
        if (!arquivo) return res.status(404).end();
        let metadata;
        let conteudo: Buffer;
        try {
          [metadata] = await arquivo.getMetadata();
          [conteudo] = await arquivo.download();
        } catch (erro) {
          if (arquivoInexistente(erro)) return res.status(404).end();
          throw erro;
        }
        res.setHeader("Content-Type", metadata.contentType || (nome.endsWith(".png") ? "image/png" : "image/jpeg"));
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Length", conteudo.byteLength);
        res.end(conteudo);
      } catch (erro) {
        next(erro);
      }
    });
  } else {
    app.use("/uploads", express.static(o.uploadsDir, { index: false, dotfiles: "deny", maxAge: "7d", fallthrough: false }));
  }

  // Front-end compilado + metadados de compartilhamento (WhatsApp/Facebook leem o HTML, não rodam JS).
  if (o.clientDir && fs.existsSync(path.join(o.clientDir, "index.html"))) {
    const indexHtml = fs.readFileSync(path.join(o.clientDir, "index.html"), "utf8");
    app.use(express.static(o.clientDir, { index: false, maxAge: "1h" }));
    app.get("/fazenda/:slug", async (req, res, next) => {
      try {
        const cfg = await lerConfig(o.db);
        const f = await obterPublicaPorSlug(o.db, String(req.params.slug), cfg.whatsapp_padrao);
        if (!f) return res.status(404).type("html").send(indexHtml.replace("<!--OG-->", ""));
        const base = (o.siteUrl || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
        const desc = esc((f.descricao || "").replace(/\s+/g, " ").slice(0, 200));
        const tags = [
          `<title>${esc(f.titulo)} — ${esc(cfg.nome_site)}</title>`,
          `<meta name="description" content="${desc}">`,
          `<meta property="og:type" content="website">`,
          `<meta property="og:title" content="${esc(f.titulo)}">`,
          `<meta property="og:description" content="${desc}">`,
          `<meta property="og:url" content="${esc(`${base}/fazenda/${f.slug}`)}">`,
          f.capa ? `<meta property="og:image" content="${esc(base + f.capa)}">` : "",
          `<meta name="twitter:card" content="summary_large_image">`,
        ].join("\n");
        res.type("html").send(indexHtml.replace("<!--OG-->", tags));
      } catch (e) { next(e); }
    });
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.type("html").send(indexHtml.replace("<!--OG-->", "")));
  }

  app.use((req, res) => res.status(404).json({ message: "Não encontrado." }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Arquivo muito grande (máx. 12 MB)." });
    if (err?.type === "entity.too.large") return res.status(413).json({ message: "Requisição muito grande." });
    if (err?.status === 404) return res.status(404).json({ message: "Não encontrado." });
    console.error("[erro]", err?.message ?? err);
    res.status(500).json({ message: "Erro interno." });
  });
  return app;
}
