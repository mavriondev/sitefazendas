import { load } from "cheerio/slim";
import { XMLParser } from "fast-xml-parser";
import type { CotacaoDolar, FonteAgro } from "../../shared/agro";

export type BuscarAgro = typeof fetch;
export const MAPA_URL = "https://www.gov.br/agricultura/pt-br/assuntos/noticias";
export const CANAL_FEED = "https://www.canalrural.com.br/feed/";
export const DOLAR_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/2?formato=json";
const LICENCA_MAPA = "https://creativecommons.org/licenses/by-nd/3.0/";
export interface NoticiaImportada {
  titulo: string; resumo_fonte: string; corpo: string[]; fonte: FonteAgro;
  fonte_nome: string; fonte_url: string; autor: string; publicado_em: string | null;
  formato: "integral" | "resumo"; licenca: string | null;
}
export function textoPlano(s: unknown): string {
  if (typeof s !== "string") return "";
  const $ = load(s);
  $("script,style,noscript,iframe,svg,form").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
}
export function urlFonte(raw: string, fonte: FonteAgro): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash) return null;
    if (fonte === "mapa" && (u.hostname !== "www.gov.br" || !u.pathname.startsWith("/agricultura/pt-br/assuntos/noticias/"))) return null;
    if (fonte === "canal-rural" && u.hostname !== "www.canalrural.com.br") return null;
    if (u.search) return null;
    return u.href;
  } catch { return null; }
}
export async function buscarTexto(url: string, buscar: BuscarAgro = fetch): Promise<string> {
  const r = await buscar(url, {
    redirect: "error", signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Gramogol/1.0 (leitor de fontes publicas)", Accept: "text/html,application/rss+xml,application/json,text/xml" },
  });
  if (!r.ok || Number(r.headers.get("content-length")) > 2_000_000) throw Error("fonte_indisponivel");
  if (!r.body) throw Error("fonte_vazia");
  const leitor = r.body.getReader(); const partes: Uint8Array[] = []; let tamanho = 0;
  try {
    while (true) {
      const v = await leitor.read(); if (v.done) break;
      tamanho += v.value.byteLength;
      if (tamanho > 2_000_000) { await leitor.cancel(); throw Error("fonte_muito_grande"); }
      partes.push(v.value);
    }
  } finally { leitor.releaseLock(); }
  return Buffer.concat(partes).toString("utf8");
}
function dataValida(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
export function lerFeedCanal(xml: string): NoticiaImportada[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error("xml_nao_permitido");
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: false, parseTagValue: false });
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item;
  if (!items) throw Error("feed_invalido");
  const result: NoticiaImportada[] = []; const vistos = new Set<string>();
  for (const item of (Array.isArray(items) ? items : [items]).slice(0, 20)) {
    const link = urlFonte(String(item.link ?? ""), "canal-rural");
    const titulo = textoPlano(item.title).slice(0, 250);
    if (!link || !titulo || vistos.has(link)) continue;
    vistos.add(link);
    // Somente a apresentação curta distribuída pelo RSS; nunca content:encoded
    // nem a matéria completa sem licença. O crédito é explicitamente do portal.
    const descricao = textoPlano(item.description);
    const resumo = Array.from(descricao).slice(0, 220).join("") + (descricao.length > 220 ? "…" : "");
    result.push({ titulo, resumo_fonte: resumo, corpo: [], fonte: "canal-rural",
      fonte_nome: "Canal Rural", fonte_url: link, autor: textoPlano(item["dc:creator"]).slice(0, 180),
      publicado_em: dataValida(item.pubDate), formato: "resumo", licenca: null });
  }
  return result;
}
export function linksMapa(html: string): string[] {
  const $ = load(html); const urls = new Set<string>();
  const manchetes = $(".tileHeadline a, .tile-headline a");
  // O portal oficial também usa cartões sem as classes do Plone antigo.
  (manchetes.length ? manchetes : $("a[href]")).each((_i, el) => {
    const u = urlFonte($(el).attr("href") ?? "", "mapa");
    if (u) urls.add(u);
  });
  return [...urls].slice(0, 4);
}
export function lerMateriaMapa(html: string, url: string): NoticiaImportada {
  const seguro = urlFonte(url, "mapa"); if (!seguro) throw Error("url_nao_permitida");
  const $ = load(html); $("script,style,noscript,iframe,form").remove();
  const titulo = textoPlano($(".documentFirstHeading").text()).slice(0, 250);
  const resumo = textoPlano($(".documentDescription").text()).slice(0, 1000);
  const corpo = $("#parent-fieldname-text p, #parent-fieldname-text h2, #parent-fieldname-text h3, #parent-fieldname-text li, #parent-fieldname-text tr")
    .filter((_i, el) => !$(el).parents("li,tr").length)
    .map((_i, el) => $(el).is("tr") ? $(el).find("td,th").map((_j, cel) => $(cel).text().replace(/\s+/g, " ").trim()).get().join(" | ") : $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  if (!titulo || !corpo.length || corpo.join("").length > 120_000) throw Error("materia_invalida");
  const licenca = $('a[rel="license"]').attr("href") ?? "";
  const permitida = licenca.startsWith(LICENCA_MAPA) &&
    !/reprodu[çc][aã]o proibida|todos os direitos reservados|copyright\s*[©(]/i.test(corpo.join(" "));
  const dataTexto = $(".documentPublished .value").first().text().trim();
  const br = dataTexto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2})[h:](\d{2}))?/);
  const publicado = dataValida($('meta[property="article:published_time"]').attr("content")) ??
    (br ? dataValida(`${br[3]}-${br[2]}-${br[1]}T${br[4] ?? "12"}:${br[5] ?? "00"}:00-03:00`) : null);
  return { titulo, resumo_fonte: resumo, corpo: permitida ? corpo : [],
    fonte: "mapa", fonte_nome: "Ministério da Agricultura e Pecuária", fonte_url: seguro,
    autor: "Ministério da Agricultura e Pecuária", publicado_em: publicado,
    formato: permitida ? "integral" : "resumo", licenca: permitida ? licenca : null };
}
export function lerDolar(json: string, agora = new Date()): CotacaoDolar {
  const raw: unknown = JSON.parse(json);
  if (!Array.isArray(raw)) throw Error("cotacao_invalida");
  const valores = raw.map(x => {
    const m = typeof x?.data === "string" ? x.data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) : null;
    const valor = typeof x?.valor === "string" ? Number(x.valor.replace(",", ".")) : NaN;
    const data = m ? `${m[3]}-${m[2]}-${m[1]}` : "";
    return { valor, data };
  }).filter(x => Number.isFinite(x.valor) && x.valor > 0 && x.data && Number.isFinite(Date.parse(x.data)))
    .sort((a, b) => a.data.localeCompare(b.data));
  const atual = valores.at(-1), anterior = valores.at(-2);
  if (!atual || Date.parse(atual.data) > agora.getTime() + 86400000) throw Error("cotacao_invalida");
  return { valor: atual.valor, anterior: anterior?.valor ?? null,
    variacao: anterior ? (atual.valor / anterior.valor - 1) * 100 : null,
    data: atual.data, consultado_em: agora.toISOString(),
    desatualizado: agora.getTime() - Date.parse(atual.data) > 7 * 86400000,
    fonte: "Banco Central do Brasil" };
}
