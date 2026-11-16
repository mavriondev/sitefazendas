import { ATRIBUTOS } from "./atributos";

export const LIMITE_CARDS = 24;
export const ICONES_CARDS = {
  info: "Informação", area: "Área", regiao: "Região", agua: "Água", solo: "Solo",
  relevo: "Relevo", estrutura: "Estrutura", acesso: "Acesso", vocacao: "Vocação",
  energia: "Energia", arvores: "Árvores", documento: "Documento",
} as const;
export type IconeCard = keyof typeof ICONES_CARDS;
export type CardFazenda = {
  id: string; titulo: string; complemento: string; icone: IconeCard; visivel: boolean;
} & ({ tipo: "editorial"; informacao: string } | { tipo: "vinculado"; origem: string });
export interface CardPublico {
  id: string; titulo: string; informacao: string; complemento: string; icone: IconeCard;
  atributo?: { chave: string; origem: "oficial" | "corretor"; confianca: "confirmado" | "indicado"; fonte?: string; atualizado_em?: string };
}
export interface BaseCardsPublica {
  area: string | null; regiao: string; culturas: string[];
  atributos: Array<{ chave: string; texto: string; origem: "oficial" | "corretor"; confianca: "confirmado" | "indicado"; fonte?: string; atualizado_em?: string }>;
}
export const ORIGENS_CARDS = [
  { chave: "area", rotulo: "Área pública" }, { chave: "regiao", rotulo: "Região pública" },
  { chave: "culturas", rotulo: "Culturas / vocação" },
  ...ATRIBUTOS.filter(a => a.publicavel && a.chave !== "area_total_ha").map(a => ({ chave: `atributo:${a.chave}`, rotulo: a.rotulo })),
];

/** null é legado; [] é uma decisão editorial explícita de não exibir cards. */
export function cardsIniciais(base: BaseCardsPublica): CardFazenda[] {
  return [
    { id: "inicial-area", titulo: "Área", origem: "area", icone: "area" },
    { id: "inicial-regiao", titulo: "Região", origem: "regiao", icone: "regiao" },
    { id: "inicial-culturas", titulo: "Vocação", origem: "culturas", icone: "vocacao" },
    { id: "inicial-agua", titulo: "Água", origem: "atributo:agua", icone: "agua" },
  ].map(c => ({ ...c, tipo: "vinculado", complemento: "", visivel: true } as CardFazenda))
    .filter(c => resolverCards([c], base).length > 0);
}

/** Só recebe a projeção pública, nunca valores crus do cadastro técnico. */
export function resolverCards(cards: CardFazenda[] | null | undefined, base: BaseCardsPublica): CardPublico[] {
  if (cards == null) return resolverCards(cardsIniciais(base), base);
  return cards.flatMap(c => {
    if (!c.visivel) return [];
    let informacao = "";
    let atributo: CardPublico["atributo"];
    if (c.tipo === "editorial") informacao = c.informacao;
    else if (c.origem === "area") {
      informacao = base.area ?? "";
      const a = base.atributos.find(a => a.chave === "area_total_ha");
      if (a) { const { texto: _, ...meta } = a; atributo = meta; }
    } else if (c.origem === "regiao") informacao = base.regiao;
    else if (c.origem === "culturas") informacao = base.culturas.join(" · ");
    else {
      const a = base.atributos.find(a => `atributo:${a.chave}` === c.origem);
      if (a) { informacao = a.texto; const { texto: _, ...meta } = a; atributo = meta; }
    }
    if (!c.titulo.trim() || !informacao.trim()) return [];
    return [{ id: c.id, titulo: c.titulo, informacao, complemento: c.complemento, icone: c.icone, ...(atributo ? { atributo } : {}) }];
  });
}

export function validarCards(entrada: unknown): { cards?: CardFazenda[]; erro?: string } {
  if (!Array.isArray(entrada) || entrada.length > LIMITE_CARDS) return { erro: `Use uma lista com até ${LIMITE_CARDS} cards.` };
  const ids = new Set<string>();
  const cards: CardFazenda[] = [];
  for (const v of entrada) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return { erro: "Card inválido." };
    const campos = ["id", "titulo", "complemento", "icone", "visivel", "tipo", v.tipo === "editorial" ? "informacao" : "origem"];
    if (Object.keys(v).some(k => !campos.includes(k))) return { erro: "Campo de card desconhecido." };
    if (typeof v.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(v.id) || ids.has(v.id)) return { erro: "Identificador de card inválido ou repetido." };
    ids.add(v.id);
    if (typeof v.icone !== "string" || !Object.hasOwn(ICONES_CARDS, v.icone) || typeof v.visivel !== "boolean") return { erro: "Ícone ou visibilidade inválidos." };
    for (const [k, max] of [["titulo", 80], ["complemento", 240], ["informacao", 320]] as const) {
      if (k === "informacao" && v.tipo !== "editorial") continue;
      if (typeof v[k] !== "string" || v[k].length > max || /[<>\u0000-\u001f\u007f]/.test(v[k])) return { erro: `${k}: use texto simples com até ${max} caracteres.` };
      if (k !== "complemento" && !v[k].trim()) return { erro: "Título e informação principal são obrigatórios, inclusive em cards ocultos." };
    }
    const comum = { id: v.id, titulo: v.titulo.trim(), complemento: v.complemento.trim(), icone: v.icone as IconeCard, visivel: v.visivel };
    if (v.tipo === "editorial") cards.push({ ...comum, tipo: "editorial", informacao: v.informacao.trim() });
    else if (v.tipo === "vinculado" && ORIGENS_CARDS.some(o => o.chave === v.origem)) cards.push({ ...comum, tipo: "vinculado", origem: v.origem });
    else return { erro: "Origem pública inválida." };
  }
  return { cards };
}
