import { resolverCards, type BaseCardsPublica, type CardFazenda, type CardPublico } from "../../shared/cards";
import { vazaDadoSensivel, semAcento, type DadosPrivados } from "./sigilo";

type PrivadoCard = DadosPrivados & { area_ha?: string | number | null };

/** Área deve vir do vínculo público, nunca de uma cópia editorial da medida privada.
 * A autorização e a formatação ficam na origem do atributo, não no card. */
export function problemasSigiloCard(c: CardFazenda, privado: PrivadoCard): string[] {
  const campos = [c.titulo, c.complemento, ...(c.tipo === "editorial" ? [c.informacao] : [])];
  const texto = campos.join(" ");
  const problemas = vazaDadoSensivel(texto, privado);
  const normal = semAcento(texto).toLowerCase();
  const area = Number(privado.area_ha);
  // Também detecta a cópia da medida interna sem unidade ou com separadores brasileiros.
  const copiaAreaInterna = area > 0 && [...normal.matchAll(/\d(?:[\d., ]*\d)?/g)].some(([token]) => {
    const n = token.replace(/\s/g, "");
    return [Number(n), Number(n.replace(/\./g, "").replace(",", ".")), Number(n.replace(/,/g, ""))]
      .some(valor => valor === area);
  });
  if (/\d[\d.,\s]*\s*(?:ha\b|hectares?\b|alqueires?\b|km[²2](?!\w)|m[²2](?!\w))/i.test(normal)
    || (/\b(area|hectares?|alqueires?)\b/.test(normal) && /\d/.test(normal)) || copiaAreaInterna) {
    problemas.push("contém uma medida de área em texto próprio; use o vínculo Área pública");
  }
  return [...new Set(problemas)];
}

export function problemasCards(cards: CardFazenda[] | null | undefined, privado: PrivadoCard): string[] {
  return (cards ?? []).filter(c => c.visivel).flatMap((c, i) =>
    problemasSigiloCard(c, privado).map(p => `O card ${i + 1} ${p}.`));
}

/** Defesa também na leitura: mudanças posteriores no cadastro privado não publicam texto inseguro. */
export function cardsParaPublico(cards: CardFazenda[] | null | undefined, base: BaseCardsPublica, privado: PrivadoCard): CardPublico[] {
  const seguros = cards?.filter(c => !problemasSigiloCard(c, privado).length);
  return resolverCards(seguros, base).filter(c =>
    !vazaDadoSensivel([c.titulo, c.informacao, c.complemento].join(" "), privado).length);
}
