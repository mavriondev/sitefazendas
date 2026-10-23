import type { Db } from "../db";
import type { AtributoRow } from "./publico";
import { defAtributo } from "../../shared/atributos";
import { estadoBrasileiro } from "../../shared/filtros-publicos";
import { estadoAutomatico, validarConfirmacao, type Achado } from "../../shared/confianca";

export interface EntradaManual {
  achado: string; valor?: unknown; fonte?: string; observacao?: string;
  confirmado_por?: string; publico?: boolean;
}

/** Valida a entrada manual de um atributo. Devolve erro (texto) ou null. */
export function validarEntradaManual(chave: string, e: EntradaManual): string | null {
  const def = defAtributo(chave);
  if (!def) return "Atributo desconhecido.";
  for (const k of ["fonte", "observacao", "confirmado_por"] as const) {
    if (e[k] != null && typeof e[k] !== "string") return `${k} deve ser texto.`;
  }
  if (e.publico !== undefined && typeof e.publico !== "boolean") return "publico deve ser booleano.";
  if (e.achado !== "detectado" && e.achado !== "nao_detectado") return "achado deve ser detectado ou nao_detectado.";
  if (e.confirmado_por) {
    const erro = validarConfirmacao({ achado: e.achado, origem: e.confirmado_por });
    if (erro) return erro;
  }
  if (e.achado === "detectado") {
    if (chave === "estado_publico" && !estadoBrasileiro(e.valor)) return "Selecione um estado brasileiro válido.";
    if (chave === "area_total_ha" && (typeof e.valor !== "number" || e.valor <= 0 || e.valor >= 1e7)) return "Área total pública inválida.";
    if (chave === "altitude_media" && (typeof e.valor !== "number" || e.valor < 0 || e.valor >= 10000)) return "Altitude fora do intervalo.";
    if (chave === "argila_media" && (typeof e.valor !== "number" || e.valor < 0 || e.valor > 100)) return "Argila deve ficar entre 0 e 100%.";
    if (def.tipo === "numero") {
      if (typeof e.valor !== "number" || !Number.isFinite(e.valor)) return `${def.rotulo}: informe um número.`;
      if (e.valor < -1000 || e.valor > 1e7) return `${def.rotulo}: valor fora do intervalo.`;
    } else if (typeof e.valor !== "string" || !e.valor.trim()) return `${def.rotulo}: informe o texto.`;
    else if (e.valor.length > 500) return `${def.rotulo}: texto muito longo.`;
  }
  if (e.publico && !def.publicavel) return `"${def.rotulo}" nunca pode ser público.`;
  if (typeof e.observacao === "string" && e.observacao.length > 500) return "Observação muito longa.";
  return null;
}

/** Mesma projeção usada na validação ANTES do único UPSERT atômico. */
export function atributoManual(chave: string, e: EntradaManual): AtributoRow {
  const confirmado = !!e.confirmado_por;
  return {
    chave, estado: confirmado ? "confirmado" : "indicado", achado: e.achado as AtributoRow["achado"],
    valor_json: e.achado === "detectado" ? e.valor ?? null : null,
    fonte: confirmado ? `Confirmado por ${e.confirmado_por}` : (e.fonte?.trim() || "Informado pelo corretor (sem documento)"),
    observacao: e.observacao?.trim() || null, confirmado_por: e.confirmado_por ?? null,
    consultado_em: new Date().toISOString(), publico: !!e.publico, origem: "corretor",
  };
}

export async function gravarManual(db: Db, fazendaId: number, chave: string, e: EntradaManual): Promise<void> {
  const a = atributoManual(chave, e);
  await db.query(
    `INSERT INTO fazenda_atributos (fazenda_id, chave, estado, achado, valor_json, fonte, observacao, confirmado_por, consultado_em, publico, origem)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8, now(), $9, 'corretor')
     ON CONFLICT (fazenda_id, chave) DO UPDATE SET
       estado = EXCLUDED.estado, achado = EXCLUDED.achado, valor_json = EXCLUDED.valor_json, fonte = EXCLUDED.fonte,
       observacao = EXCLUDED.observacao, confirmado_por = EXCLUDED.confirmado_por, consultado_em = now(), publico = EXCLUDED.publico, origem = 'corretor'`,
    [
      fazendaId, chave, a.estado, a.achado, JSON.stringify(a.valor_json),
      a.fonte, a.observacao, a.confirmado_por, a.publico,
    ],
  );
}

/** Leitura AUTOMÁTICA (Hub etc.). Nunca sobrescreve confirmação humana. Devolve "gravado" ou "mantido". */
export async function gravarAutomatico(
  db: Db, fazendaId: number, chave: string,
  p: { achado: Achado; valor?: unknown; fonte: string; observacao?: string },
): Promise<"gravado" | "mantido"> {
  const atual = await db.query<{ estado: string; achado: string }>("SELECT estado, achado FROM fazenda_atributos WHERE fazenda_id=$1 AND chave=$2", [fazendaId, chave]);
  if (atual.rows[0]?.estado === "confirmado") return "mantido";
  // Falha de consulta não apaga uma leitura anterior boa (falha não é ausência).
  if (p.achado === "indeterminado" && atual.rows[0] && atual.rows[0].achado !== "indeterminado") return "mantido";
  const estado = estadoAutomatico(p.achado);
  await db.query(
    `INSERT INTO fazenda_atributos (fazenda_id, chave, estado, achado, valor_json, fonte, observacao, confirmado_por, consultado_em, publico, origem)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,NULL, now(), FALSE, 'oficial')
     ON CONFLICT (fazenda_id, chave) DO UPDATE SET
       estado = EXCLUDED.estado, achado = EXCLUDED.achado, valor_json = EXCLUDED.valor_json, fonte = EXCLUDED.fonte,
       observacao = EXCLUDED.observacao, confirmado_por = NULL, consultado_em = now(), origem = 'oficial'`,
    [fazendaId, chave, estado, p.achado, JSON.stringify(p.achado === "indeterminado" ? null : (p.valor ?? null)), p.fonte, p.observacao ?? null],
  );
  return "gravado";
}
