import crypto from "node:crypto";
import path from "node:path";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { criarApp } from "./app";
import { criarDbPg } from "./db";
import { migrar } from "./schema";
import { garantirAdmin } from "./auth";

async function main() {
  const producao = process.env.NODE_ENV === "production";
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL (PostgreSQL deste site — um banco NOVO, separado do Mavrion Connect).");
  if (producao && !process.env.UPLOADS_DIR) {
    throw new Error("Defina UPLOADS_DIR: pasta em disco PERSISTENTE para as fotos (e faça backup dela).");
  }
  let segredo = process.env.SESSION_SECRET || "";
  if (!segredo) {
    if (producao) throw new Error("Defina SESSION_SECRET (texto aleatório longo).");
    segredo = crypto.randomBytes(32).toString("hex");
    console.warn("[aviso] SESSION_SECRET ausente: usando segredo temporário (as sessões caem a cada reinício).");
  }
  if (producao && Buffer.byteLength(segredo, "utf8") < 32) {
    throw new Error("SESSION_SECRET deve ter pelo menos 32 bytes em produção.");
  }
  const db = criarDbPg(url);
  await migrar(db);
  const adm = await garantirAdmin(db, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  if (adm === "criado") console.log("[admin] Administrador criado a partir de ADMIN_EMAIL/ADMIN_PASSWORD. Troque a senha depois.");
  if (adm === "ignorado") console.warn("[admin] Nenhum admin existe. Defina ADMIN_EMAIL e ADMIN_PASSWORD (mín. 12 caracteres) e reinicie.");

  const PgStore = connectPgSimple(session);
  const app = criarApp({
    db,
    uploadsDir: path.resolve(process.env.UPLOADS_DIR || "uploads"),
    segredo,
    producao,
    limitar: true,
    sessionStore: new PgStore({ pool: db.pool, createTableIfMissing: true }),
    clientDir: path.resolve("dist/public"),
    siteUrl: process.env.SITE_URL,
  });
  const porta = Number(process.env.PORT) || 5000;
  // Na VPS, BIND_HOST=127.0.0.1 impede acesso direto que contorne o Nginx.
  const servidor = app.listen(porta, process.env.BIND_HOST || "0.0.0.0", () => console.log(`[site] no ar na porta ${porta}`));
  servidor.requestTimeout = 30_000;
  servidor.headersTimeout = 15_000;
}

main().catch((e) => { console.error("[falha ao iniciar]", e.message); process.exit(1); });
