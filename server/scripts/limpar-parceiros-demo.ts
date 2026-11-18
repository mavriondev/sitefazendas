import fs from "node:fs/promises";
import { criarDbPg, type Db } from "../db";
import { aplicarLimpezaParceiros, hashPlanoParceiros, planejarLimpezaParceiros } from "../lib/parceiros-demo";

async function main() {
  const aplicar = process.argv.includes("--apply");
  const arg = (chave: string) => process.argv.find(a => a.startsWith(`--${chave}=`))?.slice(chave.length + 3);
  const runtime = arg("runtime");
  const config = runtime ? JSON.parse(await fs.readFile(runtime, "utf8")) : process.env;
  if (!config.DATABASE_URL || !config.UPLOADS_DIR) throw Error("Informe explicitamente DATABASE_URL e UPLOADS_DIR ou --runtime.");
  const esperado = arg("expected-plan");
  if (aplicar && !/^[a-f0-9]{64}$/.test(esperado || "")) throw Error("Confira o dry-run antes de aplicar com --expected-plan.");
  const { pool } = criarDbPg(config.DATABASE_URL);
  const cliente = await pool.connect();
  const db: Db = { async query(text, params) {
    const r = await cliente.query(text, params);
    return { rows: r.rows, rowCount: r.rowCount || 0 };
  }};
  try {
    await db.query(`BEGIN ISOLATION LEVEL REPEATABLE READ${aplicar ? "" : " READ ONLY"}`);
    const antes = (await db.query<{ id: number }>("SELECT id FROM parceiros ORDER BY id")).rows.map(p => p.id);
    const plano = await planejarLimpezaParceiros(db, config.UPLOADS_DIR);
    const sha = hashPlanoParceiros(plano);
    if (aplicar) {
      if (sha !== esperado) throw Error("Plano mudou; refaça a conferência.");
      await aplicarLimpezaParceiros(db, plano);
    }
    const removidos = plano.map(p => p.id);
    const preservados = antes.filter(id => !removidos.includes(id));
    if (aplicar) {
      const depois = (await db.query<{ id: number }>("SELECT id FROM parceiros ORDER BY id")).rows.map(p => p.id);
      if (JSON.stringify(depois) !== JSON.stringify(preservados)) throw Error("Conferência dos preservados falhou.");
    }
    await db.query(aplicar ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ dry_run: !aplicar, plano_sha256: sha, candidatos: removidos, preservados }));
  } catch (e) { await db.query("ROLLBACK").catch(() => {}); throw e; }
  finally { cliente.release(); await pool.end(); }
}
main().catch(() => {
  console.error("Limpeza interrompida sem alterações parciais. Confira a configuração e o plano, sem imprimir credenciais.");
  process.exitCode = 1;
});
