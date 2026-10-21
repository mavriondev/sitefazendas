// Catálogo de atributos de uma fazenda e como cada um pode aparecer em público.
// A vitrine NUNCA mostra número exato de atributos geográficos: mostra faixa.

export type TipoAtributo = "numero" | "texto" | "sim_nao";

export interface DefAtributo {
  chave: string;
  rotulo: string;
  tipo: TipoAtributo;
  unidade?: string;
  /** Pode aparecer na vitrine (se o admin marcar como público e o estado não for "sem dado"). */
  publicavel: boolean;
  /** Passo da faixa pública para números (ex.: 100 → "800 a 900 m"). */
  passoFaixa?: number;
  /** Dias até a leitura automática ser considerada desatualizada. */
  validadeDias: number;
  /** Usado nos filtros da vitrine. */
  filtravel?: boolean;
}

export const ATRIBUTOS: DefAtributo[] = [
  { chave: "altitude_media", rotulo: "Altitude", tipo: "numero", unidade: "m", publicavel: true, passoFaixa: 100, validadeDias: 3650, filtravel: true },
  { chave: "argila_media", rotulo: "Argila no solo", tipo: "numero", unidade: "%", publicavel: true, passoFaixa: 5, validadeDias: 3650, filtravel: true },
  { chave: "declividade_media", rotulo: "Relevo", tipo: "numero", unidade: "%", publicavel: true, validadeDias: 3650 },
  { chave: "precipitacao_anual", rotulo: "Chuva média anual", tipo: "numero", unidade: "mm", publicavel: true, passoFaixa: 100, validadeDias: 730 },
  { chave: "area_aproveitavel_ha", rotulo: "Área aproveitável", tipo: "numero", unidade: "ha", publicavel: true, passoFaixa: 50, validadeDias: 730 },
  { chave: "agua", rotulo: "Água", tipo: "texto", publicavel: true, validadeDias: 730 },
  { chave: "energia", rotulo: "Energia elétrica", tipo: "texto", publicavel: true, validadeDias: 730 },
  { chave: "uso_solo", rotulo: "Uso do solo", tipo: "texto", publicavel: true, validadeDias: 365 },
  { chave: "ndvi", rotulo: "Vigor da vegetação (NDVI)", tipo: "numero", publicavel: false, validadeDias: 45 },
  { chave: "logistica_rodovia", rotulo: "Distância à rodovia", tipo: "numero", unidade: "m", publicavel: true, validadeDias: 730 },
  { chave: "logistica_ferrovia", rotulo: "Distância à ferrovia", tipo: "numero", unidade: "m", publicavel: true, validadeDias: 730 },
  { chave: "benfeitorias", rotulo: "Benfeitorias", tipo: "texto", publicavel: true, validadeDias: 730 },
  { chave: "documentacao", rotulo: "Documentação", tipo: "texto", publicavel: true, validadeDias: 365 },
  // Nunca públicos (só para o corretor): sobreposições e restrições.
  { chave: "sobreposicoes", rotulo: "Sobreposições (TI, quilombola, UC...)", tipo: "texto", publicavel: false, validadeDias: 180 },
  { chave: "alertas_desmatamento", rotulo: "Alertas de desmatamento", tipo: "texto", publicavel: false, validadeDias: 30 },
  { chave: "app_estimada", rotulo: "APP mínima estimada", tipo: "texto", publicavel: false, validadeDias: 365 },
];

const POR_CHAVE = new Map(ATRIBUTOS.map((a) => [a.chave, a]));
export const defAtributo = (chave: string): DefAtributo | undefined => POR_CHAVE.get(chave);
export const chaveValida = (chave: string): boolean => POR_CHAVE.has(chave);
