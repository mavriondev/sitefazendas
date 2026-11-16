import { PGlite } from "@electric-sql/pglite";
import type { AddressInfo } from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Database, Query } from "../server/db";
import { migrate } from "../server/db";
import { bootstrap } from "../server/users";
import { createCrm } from "../server/app";
import { refresh } from "../server/source";
import type { Source } from "../server/source";
import { publicUser } from "../server/security";
import { migrar } from "../../server/schema";
import { syntheticPhoto } from "./photo";
export const TEST_PASSWORD = "Senha-exclusiva-teste-2026";
export const PHOTO = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png";
export const PNG = syntheticPhoto();
export const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
export function wrap(pg: PGlite): Database {
  const query = (p: any): Query => ({
    async query<T>(sql: string, params?: unknown[]) { const r = await p.query(sql, params); return { rows: r.rows as T[], rowCount: r.affectedRows || r.rows.length }; },
  });
  return { ...query(pg), transaction: fn => pg.transaction(tx => fn(query(tx))) };
}
export async function fixture(clientDir?: string, limit = false) {
  const crmPg = new PGlite(), sitePg = new PGlite(); const db = wrap(crmPg), site = wrap(sitePg);
  await migrate(db); await migrar(site); await bootstrap(db, "gestor@crm.test", TEST_PASSWORD);
  await site.query(`INSERT INTO fazendas(id,slug,titulo,status,regiao_publica,area_ha,descricao_publica,notas_internas)
    VALUES(1,'fazenda-horizonte','Fazenda Horizonte','publicada','Norte de Minas Gerais',1250,'Pecuária e recursos hídricos.','Documentação em análise.'),
    (2,'fazenda-veredas','Fazenda Veredas','rascunho','Centro-Oeste',800,'Área para agricultura.','Acesso restrito.')`);
  await site.query("INSERT INTO fazenda_atributos(fazenda_id,chave,estado,achado,valor_json,publico) VALUES(1,'agua','confirmado','detectado','\"Córrego perene\"',TRUE)");
  await site.query("INSERT INTO fazenda_fotos(fazenda_id,arquivo,legenda,capa) VALUES(1,$1,'Vista da propriedade',TRUE)", [PHOTO]);
  await site.query("INSERT INTO contatos(id,nome,whatsapp,email,mensagem,origem,fazenda_id) VALUES(1,'Marina Costa','5534999991111','marina@crm.test','Tenho interesse em visitar.','vitrine',1)");
  await site.query("INSERT INTO apresentacoes(id,comprador_nome,comprador_contato,canal,fazenda_id) VALUES(1,'Rafael Lima','5534999992222','whatsapp',1)");
  let failing = false, reads = 0;
  const source: Source = { async read() {
    reads++; if (failing) throw Error("Fonte indisponível");
    // A interface oferecida ao CRM é somente SELECT, sem handle de migração/escrita.
    const farms = (await site.query("SELECT * FROM fazendas ORDER BY id")).rows;
    for (const f of farms) {
      f.atributos = (await site.query("SELECT * FROM fazenda_atributos WHERE fazenda_id=$1", [f.id])).rows;
      f.fotos = (await site.query("SELECT arquivo,legenda FROM fazenda_fotos WHERE fazenda_id=$1", [f.id])).rows;
    }
    return { farms, contacts: (await site.query("SELECT * FROM contatos ORDER BY id")).rows, presentations: (await site.query("SELECT * FROM apresentacoes ORDER BY id")).rows };
  } };
  const adminRow = (await db.query("SELECT * FROM crm_users WHERE papel='admin'")).rows[0];
  await refresh(db, source, publicUser(adminRow));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gramogol-crm-test-")), documentsDir = path.join(dir, "private"), photosDir = path.join(dir, "site-readonly");
  await fs.mkdir(photosDir); await fs.writeFile(path.join(photosDir, PHOTO), PNG);
  const app = createCrm({ db, source, secret: "segredo-apenas-dos-testes-crm-isolados-2026", documentsDir,
    siteUploadsDir: photosDir, siteUrl: "https://portal.test", production: false, clientDir, limit });
  const server = await new Promise<import("node:http").Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  function client() {
    let cookie = "";
    async function req(method: string, url: string, body?: unknown, csrf = true) {
      const headers: Record<string, string> = {};
      if (!["GET", "HEAD"].includes(method) && csrf) { const t = await req("GET", "/csrf"); headers["x-csrf-token"] = t.json.token; }
      if (cookie) headers.cookie = cookie;
      let data: any;
      if (body instanceof FormData) data = body;
      else if (body !== undefined) { data = JSON.stringify(body); headers["Content-Type"] = "application/json"; }
      const response = await fetch(base + "/crm/api" + url, { method, headers, body: data });
      if (response.headers.get("set-cookie")) cookie = response.headers.get("set-cookie")!.split(";")[0];
      const buffer = Buffer.from(await response.arrayBuffer()), txt = buffer.toString();
      let json: any; try { json = JSON.parse(txt); } catch { /* download */ }
      return { status: response.status, json, text: txt, buffer, headers: response.headers };
    }
    return { req, get: (p: string) => req("GET", p), post: (p: string, b: any) => req("POST", p, b), put: (p: string, b: any) => req("PUT", p, b), del: (p: string, b = {}) => req("DELETE", p, b) };
  }
  async function sourceFingerprint() {
    const data = await Promise.all(["fazendas", "fazenda_atributos", "fazenda_fotos", "contatos", "apresentacoes"].map(async t => (await site.query(`SELECT * FROM ${t} ORDER BY id`)).rows));
    return JSON.stringify(data);
  }
  return { db, site, source, app, dir, base, client, server, sourceFingerprint, failSource: (v: boolean) => { failing = v; }, reads: () => reads,
    async close() { await new Promise<void>(resolve => server.close(() => resolve())); await crmPg.close(); await sitePg.close(); await fs.rm(dir, { recursive: true, force: true }); } };
}
