import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "./db";
import type { Source } from "./source";
import { refresh, importContacts } from "./source";
import { registerUsers } from "./users";
import { registerContacts, deals, history } from "./contacts";
import { documentRoutes, listDocuments } from "./documents";
import { asyncRoute as route, who, publicUser, check, id, text, email, comparePassword, hashPassword, csrf, admin, canFarm, farmScope, Fault } from "./security";
export interface Options {
  db: Database; source?: Source; secret: string; documentsDir: string; siteUploadsDir?: string;
  production: boolean; siteUrl: string; sessionStore?: session.Store; clientDir?: string; limit?: boolean;
}
export function createCrm(o: Options) {
  check(o.secret.length >= 32, 500, "Defina um segredo próprio do CRM com ao menos 32 caracteres.");
  check(!o.production || !!o.sessionStore, 500, "Produção exige sessões persistentes próprias do CRM.");
  const app = express(); app.disable("x-powered-by"); app.set("trust proxy", 1);
  app.use("/crm", helmet({ contentSecurityPolicy: { directives: { "default-src": ["'self'"], "script-src": ["'self'"], "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:"], "connect-src": ["'self'"], "object-src": ["'none'"], "frame-src": ["'none'"], "form-action": ["'self'"],
    "frame-ancestors": o.production ? ["'none'"] : ["'self'", "https://replit.com", "https://*.replit.com", "https://*.replit.dev"],
    "upgrade-insecure-requests": o.production ? [] : null } }, frameguard: o.production ? { action: "deny" } : false, referrerPolicy: { policy: "no-referrer" } }));
  app.use("/crm", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive"); next(); });
  if (o.limit !== false) app.use("/crm/api", rateLimit({ windowMs: 60000, limit: 240, standardHeaders: true, legacyHeaders: false, message: { message: "Muitas requisições. Aguarde um minuto." } }));
  app.use("/crm/api", session({
    store: o.sessionStore, secret: o.secret, name: "gramogol.crm.sid", resave: false, saveUninitialized: false,
    cookie: { path: "/crm", httpOnly: true, sameSite: "strict", secure: o.production, maxAge: 8 * 3600000 },
  }));
  app.use("/crm/api", csrf, express.json({ limit: "32kb" }));
  app.use("/crm/api", (req, _res, next) => {
    Promise.resolve().then(async () => {
      (req as any).crmUser = null;
      const s = req.session as any;
      if (s.crmUid) {
        const row = (await o.db.query("SELECT * FROM crm_users WHERE id=$1", [s.crmUid])).rows[0];
        if (row && !row.bloqueado && row.auth_version === s.crmAuthVersion) (req as any).crmUser = publicUser(row);
        else await new Promise<void>((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
      }
    }).then(() => next()).catch(next);
  });
  const limiter = o.limit === false ? (_req: Request, _res: Response, next: NextFunction) => next() : rateLimit({
    windowMs: 15 * 60000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: "Muitas tentativas. Tente novamente em 15 minutos." },
  });
  const accountLimit = o.limit === false ? (_req: Request, _res: Response, next: NextFunction) => next() : rateLimit({
    windowMs: 15 * 60000, limit: 10, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => crypto.createHash("sha256").update(typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "invalido").digest("hex"),
    message: { message: "Muitas tentativas. Tente novamente em 15 minutos." },
  });
  const dummy = hashPassword(crypto.randomBytes(32).toString("hex"));
  app.get("/crm/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/crm/api/csrf", (req, res) => res.json({ token: (req.session as any).csrf }));
  app.get("/crm/api/me", (req, res) => res.json({ usuario: who(req) || null }));
  app.post("/crm/api/login", limiter, accountLimit, route(async (req, res) => {
    const e = email(req.body?.email), senha = req.body?.senha;
    check(typeof senha === "string" && senha.length > 0 && Buffer.byteLength(senha) <= 200, 400, "Informe a senha.");
    const row = (await o.db.query("SELECT * FROM crm_users WHERE email=$1", [e])).rows[0];
    const valid = await comparePassword(senha, row?.senha_hash ?? await dummy);
    check(row && valid && !row.bloqueado, 401, "E-mail ou senha incorretos.");
    await new Promise<void>((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
    Object.assign(req.session, { crmUid: row.id, crmAuthVersion: row.auth_version });
    await new Promise<void>((resolve, reject) => req.session.save(e => e ? reject(e) : resolve()));
    res.json({ usuario: publicUser(row) });
  }));
  app.use("/crm/api", (req, res, next) => { if (!who(req)) res.status(401).json({ message: "Entre no CRM para continuar." }); else next(); });
  app.post("/crm/api/logout", route(async (req, res) => {
    await new Promise<void>((resolve, reject) => req.session.destroy(e => e ? reject(e) : resolve()));
    res.clearCookie("gramogol.crm.sid", { path: "/crm", httpOnly: true, sameSite: "strict", secure: o.production }); res.json({ ok: true });
  }));
  registerUsers(app, o.db); registerContacts(app, o.db);
  app.get("/crm/api/farms", route(async (req, res) => {
    const rows = (await o.db.query(`SELECT f.* FROM crm_farms f WHERE ${farmScope(who(req))} ORDER BY f.snapshot->>'titulo',id`)).rows;
    const status = (await o.db.query("SELECT atualizado_em,erro FROM crm_source_status WHERE id=1")).rows[0];
    res.json({ fazendas: rows.map(farmDto), fonte: { ...status, site_url: o.siteUrl } });
  }));
  app.get("/crm/api/farms/:id", route(async (req, res) => {
    const fid = id(req.params.id), u = who(req); await canFarm(o.db, u, fid);
    const farm = (await o.db.query("SELECT * FROM crm_farms WHERE id=$1", [fid])).rows[0];
    res.json({ fazenda: farmDto(farm), documentos: await listDocuments(o.db, fid), negociacoes: await deals(o.db, u, { farm: fid }),
      historico: await history(o.db, u, { farm: fid }), site_url: o.siteUrl });
  }));
  app.get("/crm/api/farms/:id/photos/:file", route(async (req, res) => {
    const fid = id(req.params.id), file = String(req.params.file); await canFarm(o.db, who(req), fid);
    check(/^[a-f0-9]{32}\.(jpg|png)$/.test(file), 404, "Foto indisponível.");
    const row = (await o.db.query("SELECT snapshot FROM crm_farms WHERE id=$1", [fid])).rows[0];
    check(o.siteUploadsDir && row.snapshot.fotos?.some((f: any) => f.arquivo === file), 404, "Foto indisponível.");
    const filePath = path.join(o.siteUploadsDir, file); check(fs.existsSync(filePath), 404, "Foto indisponível.");
    res.type(file.endsWith(".png") ? "png" : "jpeg").sendFile(filePath);
  }));
  app.post("/crm/api/source/refresh", route(async (req, res) => { admin(req); res.json(await refresh(o.db, o.source, who(req))); }));
  app.post("/crm/api/source/import", route(async (req, res) => { admin(req); res.json(await importContacts(o.db, o.source, who(req))); }));
  documentRoutes(app, o.db, o.documentsDir);
  app.use("/crm/api", (_req, res) => res.status(404).json({ message: "Recurso não encontrado." }));
  if (o.clientDir && fs.existsSync(path.join(o.clientDir, "index.html"))) {
    app.use("/crm", express.static(o.clientDir, { index: false, maxAge: 0 }));
    app.get(/^\/crm(?:\/(?!api(?:\/|$)|assets(?:\/|$)).*)?$/, (_req, res) => res.sendFile(path.join(o.clientDir!, "index.html")));
  }
  app.use((_req, res) => res.status(404).json({ message: "Recurso não encontrado." }));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const s = err instanceof Fault ? err.status : err?.code === "LIMIT_FILE_SIZE" ? 413 : String(err?.code ?? "").startsWith("LIMIT_") ? 400
      : err?.code === "23505" ? 409 : err?.type === "entity.too.large" ? 413 : err?.type === "entity.parse.failed" || err instanceof URIError ? 400 : err?.status === 503 ? 503 : 500;
    res.status(s).json({ message: err instanceof Fault ? err.message : s === 503 ? "A origem está indisponível. Os registros anteriores foram preservados."
      : s === 413 ? "Arquivo ou requisição muito grande. Documentos: até 12 MB." : s === 409 ? "Já existe um registro com estes dados. Recarregue para conferir."
      : s === 400 ? "Requisição inválida." : "Não foi possível concluir. Tente novamente.", ...(err instanceof Fault ? err.extra : {}) });
  });
  return app;
}
function farmDto(f: any) {
  const s = f.snapshot;
  return { id: f.id, titulo: s.titulo, slug: s.slug, status: s.status, regiao: s.regiao_publica, area: s.area_ha == null ? null : String(s.area_ha),
    descricao: s.descricao_publica, dados: { culturas: s.culturas, preco: s.preco_exibicao, car: s.car_codigo, municipio: s.municipio, uf: s.uf, notas_internas: s.notas_internas },
    atributos: s.atributos ?? [], fotos: s.fotos ?? [], atualizado_em: f.atualizado_em, disponivel: f.disponivel };
}
