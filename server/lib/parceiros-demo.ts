import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Db } from "../db";
import { sanitizarImagem } from "./foto";
import { caminhoDoArquivo } from "./arquivos";

const demonstracoes = [
  { nome: "Coop Verde", logo: "logo-cooperativa.png", url: "https://example.com/", ordem: 0 },
  { nome: "Geo Campo", logo: "logo-topografia.png", url: null, ordem: 1 },
  { nome: "Agro Crédito", logo: "logo-credito.png", url: "https://example.org/", ordem: 2 },
  { nome: "Trator Sul", logo: "logo-maquinas.png", url: null, ordem: 3 },
];
export interface ParceiroDemo { id: number; nome: string; arquivo: string; url: string | null; ordem: number; ativo: boolean }
const hash = (v: Buffer | string) => createHash("sha256").update(v).digest("hex");
export const hashPlanoParceiros = (plano: ParceiroDemo[]) => hash(JSON.stringify(plano));

/** Nome, URL, ordem E bytes do logo precisam corresponder ao seed conhecido.
 * Isso também reconhece os nomes sem [EXEMPLO] após a preparação editorial.
 * Nome desconhecido, logo ausente ou qualquer edição deixam o registro intacto.
 */
export async function planejarLimpezaParceiros(db: Db, uploadsDir: string): Promise<ParceiroDemo[]> {
  const originais = await Promise.all(demonstracoes.map(async demo => {
    const imagem = sanitizarImagem(await fs.readFile(path.resolve("server/scripts/exemplo", demo.logo)));
    if (!imagem) throw Error("Logo de demonstração inválido.");
    return { ...demo, hash: hash(imagem.dados) };
  }));
  const { rows } = await db.query<ParceiroDemo>("SELECT id,nome,arquivo,url,ordem,ativo FROM parceiros ORDER BY id");
  const plano: ParceiroDemo[] = [];
  for (const row of rows) {
    const demo = originais.find(d => (row.nome === d.nome || row.nome === `[EXEMPLO] ${d.nome}`) && row.url === d.url && row.ordem === d.ordem);
    const arquivo = row.arquivo && caminhoDoArquivo(uploadsDir, row.arquivo);
    if (!demo || !arquivo) continue;
    let bytes: Buffer;
    try { bytes = await fs.readFile(arquivo); }
    catch (e: any) { if (e.code === "ENOENT") continue; throw e; }
    if (hash(bytes) === demo.hash) plano.push(row);
  }
  return plano;
}

/** Usar dentro de transação; nunca apaga uploads, slides ou outros cadastros. */
export async function aplicarLimpezaParceiros(db: Db, plano: ParceiroDemo[]) {
  for (const p of plano) {
    const r = await db.query(`DELETE FROM parceiros WHERE id=$1 AND nome=$2 AND arquivo=$3
      AND url IS NOT DISTINCT FROM $4 AND ordem=$5 AND ativo=$6`, [p.id,p.nome,p.arquivo,p.url,p.ordem,p.ativo]);
    if (r.rowCount !== 1) throw Error("Parceiro alterado desde a conferência; refaça o plano.");
  }
}
