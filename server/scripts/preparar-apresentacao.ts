import fs from "node:fs";
import { criarDbPg, type Db } from "../db";
import { aplicarApresentacao, hashApresentacao, planejarApresentacao } from "../lib/apresentacao";

async function main() {
  const aplicar = process.argv.includes("--apply");
  const esperado = process.argv.find(a => a.startsWith("--expected-plan="))?.split("=")[1];
  if (aplicar && !/^[a-f0-9]{64}$/.test(esperado || "")) throw new Error("Faça dry-run e informe --expected-plan antes de aplicar.");
  let url = process.env.DATABASE_URL;
  if (!url) {
    // Leitura privada apenas no CLI; não exporta nem imprime o runtime ou as chaves.
    const runtime = process.argv.find(a => a.startsWith("--runtime="))?.slice("--runtime=".length) || "/etc/gramogol/runtime.json";
    url = JSON.parse(fs.readFileSync(runtime,"utf8")).DATABASE_URL;
  }
  if (!url) throw new Error("Banco do site não configurado.");
  const { pool } = criarDbPg(url);
  const cliente = await pool.connect();
  const db: Db = { async query(text,params) {
    const r = await cliente.query(text,params);
    return {rows:r.rows,rowCount:r.rowCount||0};
  }};
  try {
    await db.query(`BEGIN ISOLATION LEVEL REPEATABLE READ${aplicar ? "" : " READ ONLY"}`);
    const plano = await planejarApresentacao(db);
    const hash = hashApresentacao(plano);
    if (aplicar && hash !== esperado) throw new Error("Plano mudou desde a conferência.");
    if (aplicar) await aplicarApresentacao(db,plano);
    await db.query(aplicar ? "COMMIT" : "ROLLBACK");
    const porTabela: Record<string,number> = {};
    for (const m of plano) porTabela[m.tabela]=(porTabela[m.tabela]||0)+1;
    console.log(JSON.stringify({dry_run:!aplicar,plano_sha256:hash,campos:plano.length,por_tabela:porTabela}));
  } catch (e) {
    await db.query("ROLLBACK").catch(()=>{});
    throw e;
  } finally {
    cliente.release();
    await pool.end();
  }
}
main().catch(()=>{
  console.error("Preparação interrompida. Nenhuma transação parcial foi mantida. Confira configuração, hash do plano e edições concorrentes, sem imprimir credenciais.");
  process.exitCode=1;
});
