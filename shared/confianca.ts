// Estados de confiança dos dados de uma fazenda (mesmo modelo do Mavrion Connect).
//
// Regra central: fonte pública só ADICIONA evidência positiva; nunca prova que algo não existe
// (CAR pode estar no nome do dono antigo, bases são defasadas, o serviço pode ter falhado).
//
//   estado  confirmado → alguém confirmou (vendedor, documento ou visita) — só ação humana gera isso
//           indicado   → uma fonte automática indicou, com data
//           sem_dado   → nada se sabe
//   achado  detectado | nao_detectado | indeterminado

export type EstadoConfianca = "confirmado" | "indicado" | "sem_dado";
export type Achado = "detectado" | "nao_detectado" | "indeterminado";
export type OrigemConfirmacao = "vendedor" | "documento" | "visita";

export const ESTADOS: EstadoConfianca[] = ["confirmado", "indicado", "sem_dado"];
export const ACHADOS: Achado[] = ["detectado", "nao_detectado", "indeterminado"];
export const ORIGENS: OrigemConfirmacao[] = ["vendedor", "documento", "visita"];

/** Estado resultante de uma leitura AUTOMÁTICA (nunca "confirmado"). */
export function estadoAutomatico(achado: Achado): EstadoConfianca {
  return achado === "indeterminado" ? "sem_dado" : "indicado";
}

export function rotuloEstado(estado: EstadoConfianca, achado: Achado, origem?: string | null): string {
  if (estado === "confirmado") return `Confirmado${origem ? ` (${origem})` : ""}`;
  if (estado === "sem_dado") return "Sem dado";
  return achado === "detectado" ? "Indicado por fonte" : "Não detectado na fonte";
}

export function idadeEmDias(iso: string, agora: Date = new Date()): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((agora.getTime() - t) / 86400000));
}

/** Leitura automática mais velha que a validade deve ser refeita antes de ser tratada como atual. */
export function estaVencida(estado: EstadoConfianca, consultadoEm: string, validadeDias: number, agora: Date = new Date()): boolean {
  if (estado === "confirmado") return false;
  return idadeEmDias(consultadoEm, agora) > validadeDias;
}

export function validarConfirmacao(p: { achado: string; origem: string }): string | null {
  if (!ORIGENS.includes(p.origem as OrigemConfirmacao)) return "origem deve ser vendedor, documento ou visita";
  if (p.achado !== "detectado" && p.achado !== "nao_detectado") return "achado deve ser detectado ou nao_detectado";
  return null;
}
