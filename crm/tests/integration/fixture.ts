import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { criarApp } from "../../../server/app";
import { garantirAdmin } from "../../../server/auth";
import { migrar } from "../../../server/schema";
import { database, migrate } from "../../server/db";
import { bootstrap } from "../../server/users";
import { client } from "./http";

export const PASSWORD = "Senha-sintetica-integrada-2026";
export const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
export const SOURCE_TABLES = ["fazendas", "fazenda_atributos", "fazenda_fotos", "fazenda_documentos", "contatos", "apresentacoes"];
const root = fileURLToPath(new URL("../../..", import.meta.url));

/** Não herda PG*, DATABASE_URL, senhas ou configurações de serviços do workspace. */
const env = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C", NODE_ENV: "test" };
const command = (name: string, args: string[]) => execFileSync(name, args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 });

export function message(child: ChildProcess, predicate: (value: any) => boolean) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => finish(Error("Tempo esgotado no processo CRM integrado.")), 20000);
    const onExit = (code: number | null) => finish(Error(`CRM integrado terminou antes da resposta (${code}).`));
    const onError = (e: Error) => finish(e);
    const onMessage = (value: any) => {
      if (value.error) finish(Error(value.error));
      else if (predicate(value)) finish(null, value);
    };
    function finish(error: Error | null, value?: any) {
      clearTimeout(timer); child.off("message", onMessage); child.off("exit", onExit); child.off("error", onError);
      if (error) reject(error); else resolve(value);
    }
    child.on("message", onMessage); child.once("exit", onExit); child.once("error", onError);
  });
}

/** PostgreSQL real + dois bancos novos + aplicações HTTP reais; nenhum fixture pré-preenchido de documentos. */
export async function fixture() {
  assert.equal(process.env.NODE_ENV, "test", "Execute por npm run test:documents:integrated.");
  // Falha explicitamente se o kernel não permitir o isolamento; nunca simula uma montagem RO.
  command("unshare", ["-Urm", "true"]);
  const output = path.join(root, "generated-artifacts");
  await fs.mkdir(output, { recursive: true });
  const dir = await fs.mkdtemp(path.join(output, "documents-integrated-"));
  // O caminho do socket Unix deve ser curto, independentemente do caminho do checkout.
  const pgDir = path.join(dir, "pg"), socket = path.join(os.tmpdir(), `sf-doc-${crypto.randomBytes(8).toString("hex")}`);
  const docs = path.join(dir, "site-docs"), readonlyDocs = path.join(dir, "crm-docs");
  const uploads = path.join(dir, "uploads");
  let started = false, server: Server | undefined, child: ChildProcess | undefined;
  const pools: pg.Pool[] = [];
  const previousUmask = process.umask(0o077);
  async function close() {
    try {
      if (child && child.exitCode === null && child.signalCode === null) {
        const stopped = new Promise<void>(resolve => child!.once("exit", () => resolve()));
        child.kill("SIGTERM");
        const timer = setTimeout(() => child!.kill("SIGKILL"), 5000);
        await stopped; clearTimeout(timer);
      }
      if (server) {
        server.closeAllConnections();
        await new Promise<void>(resolve => server!.close(() => resolve()));
      }
      await Promise.all(pools.map(pool => pool.end()));
      if (started) { command("pg_ctl", ["-D", pgDir, "-m", "immediate", "-w", "stop"]); started = false; }
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(socket, { recursive: true, force: true });
    } finally { process.umask(previousUmask); }
  }
  try {
    for (const folder of [socket, docs, readonlyDocs, uploads]) await fs.mkdir(folder);
    await fs.chmod(docs, 0o2750); // pasta pré-provisionada, conforme roteiro de instalação
    command("initdb", ["-D", pgDir, "-U", "test_owner", "--auth-local=trust", "--auth-host=reject", "--no-locale", "--encoding=UTF8"]);
    // A conta reader usa senha SCRAM real; apenas o dono sintético tem trust no socket privado.
    await fs.writeFile(path.join(pgDir, "pg_hba.conf"), "local all test_owner trust\nlocal all all scram-sha-256\n");
    command("pg_ctl", ["-D", pgDir, "-l", path.join(dir, "postgres.log"), "-o", `-F -k ${socket} -c listen_addresses=''`, "-w", "start"]);
    started = true;
    const ownerConfig = { host: socket, user: "test_owner", database: "postgres", port: 5432 };
    function pool(config: pg.PoolConfig) { const p = new pg.Pool({ ...config, max: 2, connectionTimeoutMillis: 5000 }); pools.push(p); return p; }
    const control = pool(ownerConfig);
    await control.query("CREATE DATABASE site_synthetic");
    const crmPassword = crypto.randomBytes(24).toString("hex");
    await control.query(`CREATE ROLE crm_writer LOGIN PASSWORD '${crmPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
    await control.query("CREATE DATABASE crm_synthetic OWNER crm_writer");
    const sitePool = pool({ ...ownerConfig, database: "site_synthetic" });
    const crmConfig = { ...ownerConfig, database: "crm_synthetic", user: "crm_writer", password: crmPassword };
    const crmPool = pool(crmConfig), site = database(sitePool), crm = database(crmPool);
    await migrar(site); await migrate(crm);
    await garantirAdmin(site, "painel@integrado.test", PASSWORD);
    await bootstrap(crm, "gestor@integrado.test", PASSWORD);
    const readerPassword = crypto.randomBytes(24).toString("hex");
    await sitePool.query(`CREATE ROLE source_reader LOGIN PASSWORD '${readerPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
    await sitePool.query("REVOKE ALL ON DATABASE site_synthetic FROM PUBLIC");
    await sitePool.query("GRANT CONNECT ON DATABASE site_synthetic TO source_reader");
    await sitePool.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await sitePool.query("GRANT USAGE ON SCHEMA public TO source_reader");
    await sitePool.query(`GRANT SELECT ON ${SOURCE_TABLES.join(",")} TO source_reader`);
    const readerConfig = { ...ownerConfig, database: "site_synthetic", user: "source_reader", password: readerPassword };
    const reader = pool(readerConfig);
    const crmOnSite = new pg.Client({ ...crmConfig, database: "site_synthetic" });
    try { await assert.rejects(() => crmOnSite.connect(), { code: "42501" }); } finally { await crmOnSite.end(); }
    // Confirma que não há fallback para trust/credencial do dono.
    const invalid = new pg.Client({ ...readerConfig, password: "incorreta" });
    try { await assert.rejects(() => invalid.connect(), { code: "28P01" }); } finally { await invalid.end(); }
    const app = criarApp({ db: site, uploadsDir: uploads, documentosDir: docs, segredo: "segredo-sintetico-integrado-exclusivo-site",
      producao: false, limitar: false, agroAutomatico: false, siteUrl: "https://site-integrado.test" });
    server = await new Promise<Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    const siteBase = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const panel = () => client(siteBase, "/api", "/auth/csrf");
    // O site continua fora do namespace e pode gravar; o CRM vê OS MESMOS arquivos via bind RO.
    child = spawn("unshare", ["-Urm", "sh", "-eu", "-c",
      'mount --make-rprivate /; mount --bind "$1" "$2"; mount -o remount,bind,ro "$2"; exec "$3" --import tsx "$4"',
      "crm-integrated", docs, readonlyDocs, process.execPath, path.join(root, "crm/tests/integration/readonly-crm.ts")],
    { cwd: root, env, stdio: ["pipe", "pipe", "pipe", "ipc"] });
    let childLog = "";
    child.stderr!.on("data", chunk => { childLog += chunk.toString(); });
    const ready = message(child, value => value.ready);
    child.stdin!.end(JSON.stringify({ crm: crmConfig, source: readerConfig, documentsDir: readonlyDocs }));
    let port: number;
    try { port = (await ready).port; } catch (e) { throw Error(`${e}\n${childLog}`); }
    const crmBase = `http://127.0.0.1:${port}`;
    async function fingerprint() {
      const rows = [];
      for (const table of SOURCE_TABLES) rows.push((await site.query(`SELECT * FROM ${table} ORDER BY id`)).rows);
      const files = [];
      for (const name of (await fs.readdir(docs)).sort()) {
        const file = path.join(docs, name), stat = await fs.stat(file);
        files.push({ name, mode: stat.mode, hash: crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex") });
      }
      return JSON.stringify({ rows, files });
    }
    return { dir, docs, uploads, siteBase, panel, site, crm, reader, child, fingerprint, close,
      crmClient: () => client(crmBase, "/crm/api", "/csrf") };
  } catch (e) { await close(); throw e; }
}
