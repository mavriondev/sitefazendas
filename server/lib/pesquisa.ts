// Módulo B (pesquisa de terras): anonimização por nível de acesso. Puro e testável.
// O comprador NUNCA recebe: código do CAR, município, coordenadas ou polígono — em nenhum nível.
// Nível "completo" mostra números exatos de área/altitude/argila; a localização só vem do corretor, depois de NDA.

import crypto from "node:crypto";
import { faixaArea, faixaNumero } from "../../shared/faixas";
import type { FiltrosHub, HubImovel } from "./hub";

export type Nivel = "aberto" | "desbloqueado" | "completo";

export function tokenDoImovel(cod: string, segredo: string): string {
  return crypto.createHmac("sha256", segredo).update(cod.trim().toUpperCase()).digest("hex").slice(0, 20);
}

export interface ResultadoAnonimo {
  token: string; uf: string | null;
  area: string | null; altitude: string | null; argila: string | null;
  nivel: Nivel;
}

const arred = (n: number, passo: number) => Math.round(n / passo) * passo;

export function anonimizarImovel(im: HubImovel, token: string, nivel: Nivel): ResultadoAnonimo {
  let area: string | null = null, altitude: string | null = null, argila: string | null = null;
  const a = im.area_ha, alt = im.alt_media, arg = im.argila_media;
  if (nivel === "aberto") {
    area = a != null ? faixaArea(a) : null;
    altitude = alt != null ? faixaNumero(alt, 100, "m") : null;
    argila = arg != null ? faixaNumero(arg, 10, "%") : null;
  } else if (nivel === "desbloqueado") {
    area = a != null ? `cerca de ${arred(a, 10).toLocaleString("pt-BR")} ha` : null;
    altitude = alt != null ? faixaNumero(alt, 50, "m") : null;
    argila = arg != null ? faixaNumero(arg, 5, "%") : null;
  } else {
    area = a != null ? `${a.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha` : null;
    altitude = alt != null ? `${Math.round(alt)} m${im.alt_min != null && im.alt_max != null ? ` (de ${Math.round(im.alt_min)} a ${Math.round(im.alt_max)} m)` : ""}` : null;
    argila = arg != null ? `${arg.toFixed(1).replace(".", ",")}%` : null;
  }
  return { token, uf: im.uf, area, altitude, argila, nivel };
}

/** Passo da grade dos FILTROS por nível: impede "afunilar" filtros até isolar uma única propriedade. */
const GRADE: Record<Nivel, { area: number; alt: number; argila: number }> = {
  aberto: { area: 250, alt: 100, argila: 10 },
  desbloqueado: { area: 50, alt: 50, argila: 5 },
  completo: { area: 10, alt: 25, argila: 2 },
};

export interface FiltrosPesquisa {
  uf?: string; area_min?: number; area_max?: number;
  alt_media_min?: number; alt_media_max?: number; argila_media_min?: number; argila_media_max?: number;
  deslocamento?: number;
}

const baixo = (v: number | undefined, p: number) => (v === undefined ? undefined : Math.floor(v / p) * p);
const alto = (v: number | undefined, p: number) => (v === undefined ? undefined : Math.ceil(v / p) * p);

export function ajustarFiltros(f: FiltrosPesquisa, nivel: Nivel): FiltrosHub {
  const g = GRADE[nivel];
  const uf = typeof f.uf === "string" && /^[A-Za-z]{2}$/.test(f.uf) ? f.uf.toUpperCase() : undefined;
  return {
    uf,
    area_min: baixo(f.area_min, g.area), area_max: alto(f.area_max, g.area),
    alt_media_min: baixo(f.alt_media_min, g.alt), alt_media_max: alto(f.alt_media_max, g.alt),
    argila_media_min: baixo(f.argila_media_min, g.argila), argila_media_max: alto(f.argila_media_max, g.argila),
    limite: 20,
    deslocamento: Math.min(Math.max(Math.floor(f.deslocamento ?? 0), 0), 100), // teto contra varredura da base
  };
}

/** A busca precisa de ao menos UF + um critério, para não virar listagem da base inteira. */
export function filtroSuficiente(f: FiltrosHub): boolean {
  const criterios = [f.area_min, f.area_max, f.alt_media_min, f.alt_media_max, f.argila_media_min, f.argila_media_max].filter((x) => x !== undefined).length;
  return !!f.uf && criterios >= 1;
}
