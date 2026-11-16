import pg from "pg";
import session from "express-session";
import connectPg from "connect-pg-simple";
import path from "node:path";
import fs from "node:fs/promises";
import { database, migrate } from "./db";
import { createCrm } from "./app";
import { bootstrap } from "./users";
import { PgSource } from "./source";
import { check } from "./security";
const env = process.env;
async function main() {
  check(env.CRM_DATABASE_URL && env.CRM_SOURCE_DATABASE_URL && env.CRM_SESSION_SECRET && env.CRM_DOCUMENTS_DIR && env.CRM_SITE_URL, 500, "Configuração privada do CRM incompleta.");
  const crm = new URL(env.CRM_DATABASE_URL), source = new URL(env.CRM_SOURCE_DATABASE_URL);
  check(decodeURIComponent(crm.pathname) !== decodeURIComponent(source.pathname), 500, "O CRM precisa de banco com nome diferente do site, inclusive em hosts equivalentes.");
  check(/^https:\/\//.test(env.CRM_SITE_URL) && new URL(env.CRM_SITE_URL).origin === env.CRM_SITE_URL, 500, "Use uma origem HTTPS válida para o site.");
  const privateDir = path.resolve(env.CRM_DOCUMENTS_DIR);
  const publicDirs = ["dist", "dist-crm", "client/public", "crm/client", env.CRM_SITE_UPLOADS_DIR || "uploads"].map(p => path.resolve(p));
  check(publicDirs.every(d => privateDir !== d && !privateDir.startsWith(d + path.sep)) && !privateDir.includes("/uploads/"), 500, "Documentos devem ficar fora de pastas públicas.");
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
  check(!(await fs.lstat(privateDir)).isSymbolicLink(), 500, "Diretório de documentos não pode ser link simbólico.");
  await fs.chmod(privateDir, 0o700);
  const pool = new pg.Pool({ connectionString: env.CRM_DATABASE_URL, max: 6 });
  const sourcePool = new pg.Pool({ connectionString: env.CRM_SOURCE_DATABASE_URL, max: 2, options: "-c default_transaction_read_only=on", connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  const db = database(pool); await migrate(db); await bootstrap(db, env.CRM_ADMIN_EMAIL, env.CRM_ADMIN_PASSWORD);
  const Store = connectPg(session);
  const app = createCrm({
    db, source: new PgSource(sourcePool), secret: env.CRM_SESSION_SECRET, documentsDir: privateDir,
    siteUploadsDir: env.CRM_SITE_UPLOADS_DIR ? path.resolve(env.CRM_SITE_UPLOADS_DIR) : undefined,
    siteUrl: env.CRM_SITE_URL, production: true,
    sessionStore: new Store({ pool, tableName: "crm_sessions", createTableIfMissing: true }),
    clientDir: path.resolve("dist-crm/public"),
  });
  const server = app.listen(Number(env.PORT || env.CRM_PORT || 5006), env.CRM_BIND_HOST || "127.0.0.1");
  const stop = () => server.close(() => { Promise.all([pool.end(), sourcePool.end()]).then(() => process.exit(0)); });
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
main().catch(() => { console.error("[CRM] Não foi possível iniciar. Confira a configuração privada e as permissões exclusivas do CRM."); process.exitCode = 1; });
