import pg from "pg";
import session from "express-session";
import connectPg from "connect-pg-simple";
import path from "node:path";
import { database, migrate } from "./db";
import { createCrm } from "./app";
import { bootstrap } from "./users";
import { PgSource } from "./source";
import { check } from "./security";
import { numberSetting, MiB, separateDirectory } from "./materials-storage";
const env = process.env;
async function main() {
  check(env.CRM_DATABASE_URL && env.CRM_SOURCE_DATABASE_URL && env.CRM_SESSION_SECRET && env.CRM_SITE_URL, 500, "Configuração privada do CRM incompleta.");
  const crm = new URL(env.CRM_DATABASE_URL), source = new URL(env.CRM_SOURCE_DATABASE_URL);
  check(decodeURIComponent(crm.pathname) !== decodeURIComponent(source.pathname), 500, "O CRM precisa de banco com nome diferente do site, inclusive em hosts equivalentes.");
  check(/^https:\/\//.test(env.CRM_SITE_URL) && new URL(env.CRM_SITE_URL).origin === env.CRM_SITE_URL, 500, "Use uma origem HTTPS válida para o site.");
  // Documentos vêm do painel do site: ponto de montagem SOMENTE LEITURA (CRM_SITE_DOCUMENTS_DIR).
  const siteDocs = env.CRM_SITE_DOCUMENTS_DIR ? path.resolve(env.CRM_SITE_DOCUMENTS_DIR) : undefined;
  const materialsDir=env.CRM_MATERIALS_DIR?path.resolve(env.CRM_MATERIALS_DIR):undefined;
  separateDirectory(materialsDir,[siteDocs,env.CRM_SITE_UPLOADS_DIR,path.resolve("dist/public"),path.resolve("dist-crm/public")]);
  if (!siteDocs) console.warn("[CRM] CRM_SITE_DOCUMENTS_DIR ausente: a lista de documentos aparece, mas os downloads ficam indisponíveis.");
  const pool = new pg.Pool({ connectionString: env.CRM_DATABASE_URL, max: 6 });
  const sourcePool = new pg.Pool({ connectionString: env.CRM_SOURCE_DATABASE_URL, max: 2, options: "-c default_transaction_read_only=on", connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  const db = database(pool); await migrate(db); await bootstrap(db, env.CRM_ADMIN_EMAIL, env.CRM_ADMIN_PASSWORD);
  const Store = connectPg(session);
  const app = createCrm({
    db, source: new PgSource(sourcePool), secret: env.CRM_SESSION_SECRET, siteDocumentsDir: siteDocs,
    siteUploadsDir: env.CRM_SITE_UPLOADS_DIR ? path.resolve(env.CRM_SITE_UPLOADS_DIR) : undefined,
    siteUrl: env.CRM_SITE_URL, production: true,
    sessionStore: new Store({ pool, tableName: "crm_sessions", createTableIfMissing: true }),
    clientDir: path.resolve("dist-crm/public"),
    materials:{dir:materialsDir,limits:{
      video_bytes:numberSetting(env.CRM_MATERIAL_VIDEO_MAX_MB,250,1024)*MiB,
      file_bytes:numberSetting(env.CRM_MATERIAL_FILE_MAX_MB,12,100)*MiB,
      zip_bytes:numberSetting(env.CRM_MATERIAL_ZIP_MAX_MB,1024,2048)*MiB,max_items:100,
    },farmQuota:numberSetting(env.CRM_MATERIAL_FARM_QUOTA_MB,5120,102400)*MiB},
  });
  const server = app.listen(Number(env.PORT || env.CRM_PORT || 5006), env.CRM_BIND_HOST || "127.0.0.1");
  const stop = () => server.close(() => { Promise.all([pool.end(), sourcePool.end()]).then(() => process.exit(0)); });
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
main().catch(() => { console.error("[CRM] Não foi possível iniciar. Confira a configuração privada e as permissões exclusivas do CRM."); process.exitCode = 1; });
