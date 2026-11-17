// Executado APENAS pelo teste integrado, num namespace Linux com bind mount RO.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { createCrm } from "../../server/app";
import { database } from "../../server/db";
import { PgSource } from "../../server/source";

assert.equal(process.env.NODE_ENV, "test");
assert.ok(process.send, "Este processo só pode ser iniciado pelo teste integrado.");
let input = "";
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
const crmPool = new pg.Pool(config.crm);
const sourcePool = new pg.Pool({ ...config.source, options: "-c default_transaction_read_only=on" });
const app = createCrm({
  db: database(crmPool), source: new PgSource(sourcePool), siteDocumentsDir: config.documentsDir,
  secret: "segredo-sintetico-integrado-exclusivo-crm", production: false, limit: false,
  siteUrl: "https://site-integrado.test",
});
const server = app.listen(0, "127.0.0.1", () => {
  process.send!({ ready: true, port: (server.address() as AddressInfo).port });
});

process.on("message", async (message: any) => {
  if (message.probe) {
    try {
      const file = path.join(config.documentsDir, path.basename(message.file));
      // Exigir EROFS, não apenas bits de permissão ou uma simulação de fs.
      for (const operation of [
        () => fs.appendFile(file, "escrita indevida"),
        () => fs.writeFile(path.join(config.documentsDir, "novo.pdf"), "novo"),
        () => fs.mkdir(path.join(config.documentsDir, "nova-pasta")),
        () => fs.rename(file, file + ".renomeado"),
        () => fs.unlink(file),
      ]) await assert.rejects(operation, { code: "EROFS" });
      process.send!({ probe: true });
    } catch (e) { process.send!({ error: String(e) }); }
  }
});
async function close() {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await Promise.all([crmPool.end(), sourcePool.end()]);
  process.exit(0);
}
process.on("SIGTERM", () => { void close(); });
process.on("disconnect", () => { void close(); });
