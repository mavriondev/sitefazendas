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
        "img-src": ["'self'", "data:"],
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

  app.use("/uploads", express.static(o.uploadsDir, { index: false, dotfiles: "deny", maxAge: "7d", fallthrough: false }));

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
