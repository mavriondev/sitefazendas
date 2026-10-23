import crypto from "node:crypto";
import type { Db } from "../db";
import { CONFIG_AGRO_PADRAO, type ConfigAgro, type EstadoAgro, type CotacaoDolar, type NoticiaAgro } from "../../shared/agro";
import { buscarTexto, lerFeedCanal, linksMapa, lerMateriaMapa, lerDolar, MAPA_URL, CANAL_FEED, DOLAR_URL, type BuscarAgro, type NoticiaImportada } from "./agro-fontes";

const emCurso = new WeakMap<Db, Promise<EstadoAgro>>();
const intervalo = 30 * 60 * 1000;
export async function lerValorAgro<T>(db: Db, chave: string, padrao: T): Promise<T> {
  const r = await db.query<{ valor: T }>("SELECT valor FROM configuracoes WHERE chave=$1", [chave]);
  return r.rows[0]?.valor ?? padrao;
}
export async function gravarValorAgro(db: Db, chave: string, valor: unknown) {
  await db.query("INSERT INTO configuracoes(chave,valor) VALUES($1,$2::jsonb) ON CONFLICT(chave) DO UPDATE SET valor=EXCLUDED.valor", [chave, JSON.stringify(valor)]);
}
export async function configAgro(db: Db): Promise<ConfigAgro> {
  const c = await lerValorAgro<Partial<ConfigAgro>>(db, "agro_config", {});
  return { ...CONFIG_AGRO_PADRAO, ...Object.fromEntries(Object.keys(CONFIG_AGRO_PADRAO).filter(k => typeof c[k as keyof ConfigAgro] === "boolean").map(k => [k, c[k as keyof ConfigAgro]])) };
}
export const estadoVazio: EstadoAgro = { atualizado_em: null, falhas: [] };
export async function salvarImportada(db: Db, n: NoticiaImportada) {
  const slug = n.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) +
    "-" + crypto.createHash("sha256").update(n.fonte_url).digest("hex").slice(0, 10);
  await db.query(`INSERT INTO site_noticias
    (slug,titulo,resumo_fonte,corpo,fonte,fonte_nome,fonte_url,autor,publicado_em,formato,licenca)
    VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT(fonte_url) DO UPDATE SET
    titulo=EXCLUDED.titulo,resumo_fonte=EXCLUDED.resumo_fonte,corpo=EXCLUDED.corpo,
    autor=EXCLUDED.autor,publicado_em=EXCLUDED.publicado_em,formato=EXCLUDED.formato,licenca=EXCLUDED.licenca`,
  [slug, n.titulo, n.resumo_fonte, JSON.stringify(n.corpo), n.fonte, n.fonte_nome, n.fonte_url, n.autor, n.publicado_em, n.formato, n.licenca]);
}
async function executarAtualizacao(db: Db, buscar: BuscarAgro, forcar: boolean): Promise<EstadoAgro> {
  const estado = await lerValorAgro(db, "agro_estado", estadoVazio);
  if (!forcar && estado.atualizado_em && Date.now() - Date.parse(estado.atualizado_em) < intervalo) return estado;
  const c = await configAgro(db); const falhas: string[] = [];
  // Consultas somente a fontes fixas e públicas; sem cron, Hub ou Connect.
  if (c.noticias_ativas && c.mapa_ativo) {
    try {
      const urls = linksMapa(await buscarTexto(MAPA_URL, buscar));
      if (!urls.length) throw Error("lista_vazia");
      for (const url of urls) {
        try { await salvarImportada(db, lerMateriaMapa(await buscarTexto(url, buscar), url)); }
        catch { if (!falhas.includes("Notícias do Ministério da Agricultura")) falhas.push("Notícias do Ministério da Agricultura"); }
      }
    } catch { falhas.push("Notícias do Ministério da Agricultura"); }
  }
  if (c.noticias_ativas && c.canal_rural_ativo) {
    try {
      const noticias = lerFeedCanal(await buscarTexto(CANAL_FEED, buscar));
      if (!noticias.length) throw Error("feed_vazio");
      for (const n of noticias) await salvarImportada(db, n);
    } catch { falhas.push("RSS do Canal Rural"); }
  }
  if (c.cotacoes_ativas) {
    try { await gravarValorAgro(db, "agro_dolar", lerDolar(await buscarTexto(DOLAR_URL, buscar))); }
    catch { falhas.push("Dólar PTAX do Banco Central"); }
  }
  const novo = { atualizado_em: new Date().toISOString(), falhas: [...new Set(falhas)] };
  // Falhas também têm prazo: uma indisponibilidade não gera uma chamada por visitante.
  await gravarValorAgro(db, "agro_estado", novo);
  return novo;
}
export function atualizarAgro(db: Db, buscar: BuscarAgro = fetch, forcar = false): Promise<EstadoAgro> {
  const atual = emCurso.get(db); if (atual) return atual;
  const p = executarAtualizacao(db, buscar, forcar).finally(() => emCurso.delete(db));
  emCurso.set(db, p); return p;
}
export function fontesAtivas(c: ConfigAgro): string[] {
  return c.noticias_ativas ? [...(c.mapa_ativo ? ["mapa"] : []), ...(c.canal_rural_ativo ? ["canal-rural"] : [])] : [];
}
export function noticiaPublica(n: any): NoticiaAgro {
  return { id: n.id, slug: n.slug, titulo: n.titulo, chamada: n.chamada,
    resumo: n.resumo ?? n.resumo_fonte, resumo_fonte: n.resumo_fonte, corpo: n.formato === "integral" ? n.corpo : [],
    fonte: n.fonte, fonte_nome: n.fonte_nome, fonte_url: n.fonte_url, autor: n.autor,
    publicado_em: n.publicado_em ? new Date(n.publicado_em).toISOString() : null,
    importado_em: new Date(n.importado_em).toISOString(), formato: n.formato, licenca: n.licenca,
    ativo: n.ativo, ordem: n.ordem };
}
export async function dolarAgro(db: Db): Promise<CotacaoDolar | null> {
  const valor = await lerValorAgro<CotacaoDolar | null>(db, "agro_dolar", null);
  if (!valor) return null;
  const estado = await lerValorAgro(db, "agro_estado", estadoVazio);
  return { ...valor, desatualizado: valor.desatualizado ||
    Date.now() - Date.parse(valor.data) > 7 * 86400000 || estado.falhas.includes("Dólar PTAX do Banco Central") };
}
