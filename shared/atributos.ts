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
  /** Onde o dado costuma nascer: base oficial (preenchido por "Atualizar dados oficiais") ou informado pelo corretor. */
  grupo: "oficial" | "corretor";
  /** Fonte exibida ao público na aba de dados oficiais (nunca o nome de sistemas internos). */
  fontePublica?: string;
  /** Texto público fixo, para dados em que o valor exato não deve aparecer (ex.: sobreposições). */
  textoPublico?: { presente: string; ausente: string };
}

export const ATRIBUTOS: DefAtributo[] = [
  { chave: "altitude_media", rotulo: "Altitude", tipo: "numero", unidade: "m", publicavel: true, passoFaixa: 100, validadeDias: 3650, filtravel: true, grupo: "oficial", fontePublica: "SRTM/NASA (via base do SICAR)" },
  { chave: "argila_media", rotulo: "Argila no solo", tipo: "numero", unidade: "%", publicavel: true, passoFaixa: 5, validadeDias: 3650, filtravel: true, grupo: "oficial", fontePublica: "OpenGeoHub (modelo de solo, 250 m)" },
  { chave: "declividade_media", rotulo: "Relevo", tipo: "numero", unidade: "%", publicavel: true, validadeDias: 3650, grupo: "oficial", fontePublica: "SRTM/NASA" },
  { chave: "precipitacao_anual", rotulo: "Chuva média anual", tipo: "numero", unidade: "mm", publicavel: true, passoFaixa: 100, validadeDias: 730, grupo: "corretor" },
  { chave: "area_aproveitavel_ha", rotulo: "Área aproveitável", tipo: "numero", unidade: "ha", publicavel: true, passoFaixa: 50, validadeDias: 730, grupo: "corretor" },
  { chave: "agua", rotulo: "Água", tipo: "texto", publicavel: true, validadeDias: 730, grupo: "corretor" },
  { chave: "energia", rotulo: "Energia elétrica", tipo: "texto", publicavel: true, validadeDias: 730, grupo: "corretor" },
  { chave: "uso_solo", rotulo: "Uso do solo", tipo: "texto", publicavel: true, validadeDias: 365, grupo: "oficial", fontePublica: "MapBiomas" },
  { chave: "ndvi", rotulo: "Vigor da vegetação (NDVI)", tipo: "numero", publicavel: false, validadeDias: 45, grupo: "oficial", fontePublica: "Sentinel-2" },
  { chave: "logistica_rodovia", rotulo: "Distância à rodovia", tipo: "numero", unidade: "m", publicavel: true, validadeDias: 730, grupo: "oficial", fontePublica: "IBGE, Base Cartográfica 1:250.000" },
  { chave: "logistica_ferrovia", rotulo: "Distância à ferrovia", tipo: "numero", unidade: "m", publicavel: true, validadeDias: 730, grupo: "oficial", fontePublica: "IBGE, Base Cartográfica 1:250.000" },
  { chave: "benfeitorias", rotulo: "Benfeitorias", tipo: "texto", publicavel: true, validadeDias: 730, grupo: "corretor" },
  { chave: "documentacao", rotulo: "Documentação", tipo: "texto", publicavel: true, validadeDias: 365, grupo: "corretor" },
  // Sobreposições: só aparecem em público se o corretor confirmar; o texto é fixo e nunca nomeia a área.
  { chave: "sobrep_terra_indigena", rotulo: "Terra indígena", tipo: "texto", publicavel: true, validadeDias: 180, grupo: "oficial", fontePublica: "FUNAI",
    textoPublico: { presente: "Há sobreposição identificada; consulte o corretor", ausente: "Sem sobreposição" } },
  { chave: "sobrep_unidade_conservacao", rotulo: "Unidade de conservação", tipo: "texto", publicavel: true, validadeDias: 180, grupo: "oficial", fontePublica: "ICMBio (CNUC)",
    textoPublico: { presente: "Há sobreposição identificada; consulte o corretor", ausente: "Sem sobreposição" } },
  // Nunca públicos (só para o corretor): sobreposições e restrições.
  { chave: "sobreposicoes", rotulo: "Sobreposições (TI, quilombola, UC...)", tipo: "texto", publicavel: false, validadeDias: 180, grupo: "oficial" },
  { chave: "alertas_desmatamento", rotulo: "Alertas de desmatamento", tipo: "texto", publicavel: false, validadeDias: 30, grupo: "oficial", fontePublica: "MapBiomas Alerta" },
  { chave: "app_estimada", rotulo: "APP mínima estimada", tipo: "texto", publicavel: false, validadeDias: 365, grupo: "oficial", fontePublica: "Código Florestal (estimativa)" },
];

const POR_CHAVE = new Map(ATRIBUTOS.map((a) => [a.chave, a]));
export const defAtributo = (chave: string): DefAtributo | undefined => POR_CHAVE.get(chave);
export const chaveValida = (chave: string): boolean => POR_CHAVE.has(chave);
