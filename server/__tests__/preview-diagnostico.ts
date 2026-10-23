/**
 * Prévia isolada: PGlite em memória, sem DATABASE_URL, Hub ou contas reais.
 * NODE_ENV=test PORT=... tsx server/__tests__/preview-diagnostico.ts
 * Os provedores devem ser interceptados pelo navegador de teste.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { criarDbTeste, criarHubFalso, malhaOffline } from "./helpers";
import { criarApp } from "../app";
import { garantirAdmin } from "../auth";
import { seoPadrao } from "../../shared/seo";

if (process.env.NODE_ENV !== "test") throw new Error("Prévia permitida somente em NODE_ENV=test.");
const db = await criarDbTeste();
await garantirAdmin(db, "admin@teste.com", "senha-forte-1");
const seo = seoPadrao();
seo.rastreamento = {
  ga4_id: "G-TEST123456", ga4_ativo: true,
  meta_pixel_id: "123456789012345", meta_pixel_ativo: true,
};
await db.query("INSERT INTO configuracoes(chave,valor) VALUES('seo_site',$1::jsonb) ON CONFLICT(chave) DO UPDATE SET valor=EXCLUDED.valor", [JSON.stringify(seo)]);
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-diagnostico-preview-"));
const app = criarApp({
  db, uploadsDir, segredo: "segredo-ficticio-apenas-para-testes-isolados",
  producao: false, limitar: false, hub: criarHubFalso(), fontesMalha: malhaOffline,
  clientDir: path.resolve("dist/public"), siteUrl: "https://portal.teste.example",
});
const server = app.listen(Number(process.env.PORT) || 5078, "0.0.0.0", () => console.log("[teste isolado] Diagnóstico disponível; interceptar provedores no navegador."));
const fechar = () => server.close(() => { fs.rmSync(uploadsDir, { recursive: true, force: true }); process.exit(0); });
process.on("SIGTERM", fechar);
process.on("SIGINT", fechar);
