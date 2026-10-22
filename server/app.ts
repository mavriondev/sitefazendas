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
import { caminhoDoArquivo } from "./lib/arquivos";
import rateLimit from "express-rate-limit";
import { instalarCsrf, rotasSeguras, validarCorpo, validarParametros } from "./lib/seguranca";

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
        "img-src": ["'self'", "data:", "https://tile.openstreetmap.org", "https://i.ytimg.com"],
        "frame-src": ["https://www.youtube-nocookie.com"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "script-src": ["'self'"],
        "connect-src": ["'self'"],
        "upgrade-insecure-requests": o.producao ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  if (o.limitar) app.use("/api", rateLimit({
    windowMs: 60 * 1000, limit: 240, standardHeaders: true, legacyHeaders: false,
    message: { message: "Muitas requisições. Aguarde um minuto." },
  }));
  app.use(session({
    store: o.sessionStore,
    secret: o.segredo,
    name: "sf.sid",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: o.producao, maxAge: 1000 * 60 * 60 * 8 },
  }));
  instalarCsrf(app);
  const { anexar, exigirLogin, exigirAdmin } = middlewaresDeAuth(o.db);
  app.use(anexar);
  // Autenticar antes de ler corpos grandes ou receber uploads em memória.
  app.use("/api/admin", exigirAdmin);
  const jsonPublico = express.json({ limit: "16kb" });
  const jsonAdmin = express.json({ limit: "5mb" }); // GeoJSON de fazendas.
  app.use((req, res, next) => (req.path.startsWith("/api/admin/") ? jsonAdmin : jsonPublico)(req, res, next));
  app.use(validarCorpo);

  app.get("/api/saude", (_req, res) => res.json({ ok: true }));
  const rotas = rotasSeguras(app);
  for (const nome of ["id", "fotoId", "videoId"]) app.param(nome, (req, res, next) => validarParametros(req, res, next));
  registrarRotasAuth(rotas, o.db, { limitar: o.limitar });
  registrarRotasPublicas(rotas, o.db, { limitar: o.limitar });
  registrarRotasAdmin(rotas, o.db, exigirAdmin, { uploadsDir: o.uploadsDir, hub: o.hub, fetchIA: o.fetchIA });
  registrarRotasPesquisa(rotas, o.db, exigirLogin, { hub: o.hub, segredo: o.segredo });


  // robots.txt e sitemap.xml (só fazendas publicadas). Painel e API ficam fora dos buscadores.
  const baseDe = (req: Request) => (o.siteUrl || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /entrar\nDisallow: /cadastro\nDisallow: /redefinir-senha\nSitemap: ${baseDe(req)}/sitemap.xml\n`);
  });
  app.get("/sitemap.xml", async (req, res, next) => {
    try {
      const base = baseDe(req);
      const r = await o.db.query<{ slug: string; atualizado_em: string }>("SELECT slug, atualizado_em FROM fazendas WHERE status='publicada' ORDER BY id");
      const fixas = ["/", "/fazendas", "/sobre", "/parceiros", "/venda-sua-fazenda", "/contato"];
      const urls = [
        ...fixas.map((c) => `<url><loc>${esc(base + c)}</loc></url>`),
        ...r.rows.map((x) => `<url><loc>${esc(`${base}/fazenda/${x.slug}`)}</loc><lastmod>${new Date(x.atualizado_em).toISOString().slice(0, 10)}</lastmod></url>`),
      ];
      res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
    } catch (e) { next(e); }
  });
  app.use(["/admin", "/redefinir-senha"], (_req, res, next) => { res.setHeader("X-Robots-Tag", "noindex, nofollow"); next(); });

  // Fotos: publicadas ficam em cache; de fazendas não publicadas só o administrador abre (404 para os demais).
  app.get("/uploads/:arquivo", async (req, res, next) => {
    try {
      const nome = String(req.params.arquivo);
      const caminho = caminhoDoArquivo(o.uploadsDir, nome);
      if (!caminho) return res.status(404).end();
      const r = await o.db.query<{ publico: boolean }>(
        `SELECT
           EXISTS (SELECT 1 FROM fazenda_fotos p JOIN fazendas f ON f.id=p.fazenda_id WHERE p.arquivo=$1 AND f.status='publicada')
           OR EXISTS (SELECT 1 FROM slides s WHERE s.arquivo=$1 AND s.ativo)
           OR EXISTS (SELECT 1 FROM parceiros pr WHERE pr.arquivo=$1 AND pr.ativo) AS publico`,
        [nome],
      );
      const publico = !!r.rows[0]?.publico;
      if (!publico && (req as any).usuario?.papel !== "admin") return res.status(404).end();
      res.setHeader("Cache-Control", publico ? "public, max-age=86400" : "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.type(nome.endsWith(".png") ? "image/png" : "image/jpeg");
      res.sendFile(caminho, { dotfiles: "deny" }, (err) => { if (err) { if (!res.headersSent) res.status(404).end(); } });
    } catch (e) { next(e); }
  });

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
    if (res.headersSent) return _next(err);
    if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Arquivo muito grande (máx. 12 MB)." });
    if (typeof err?.code === "string" && err.code.startsWith("LIMIT_")) return res.status(400).json({ message: "Upload inválido ou com campos em excesso." });
    if (err?.type === "entity.too.large") return res.status(413).json({ message: "Requisição muito grande." });
    if (err?.type === "entity.parse.failed" || err instanceof URIError) return res.status(400).json({ message: "Requisição inválida." });
    if (err?.status === 404) return res.status(404).json({ message: "Não encontrado." });
    // Não registrar mensagens SQL, dados de formulário, tokens ou senhas.
    console.error("[erro interno]", err?.name || "Error");
    res.status(500).json({ message: "Erro interno." });
  });
  return app;
}
