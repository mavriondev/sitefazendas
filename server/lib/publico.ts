// Projeção PÚBLICA: o único caminho pelo qual dados de fazenda chegam à vitrine.
// Lista explícita de campos (allowlist) — campo novo na tabela NUNCA vira público por acidente.

import type { Db } from "../db";
import { defAtributo } from "../../shared/atributos";
import { faixaNumero, classeRelevo, faixaDistanciaKm, faixaArea } from "../../shared/faixas";
import { formaSvgAnonima } from "./forma";
import { regiaoAproximada } from "./regiao";
import { vazaDadoSensivel, type DadosPrivados } from "./sigilo";

export interface FazendaRow {
  id: number; slug: string; titulo: string; status: string; destaque: boolean; destaque_ordem: number;
  descricao_publica: string | null; regiao_publica: string | null; culturas: string[];
  area_ha: string | number | null; area_exibicao: "exata" | "faixa"; preco_exibicao: string | null;
  mostrar_mapa: boolean; mostrar_regiao: boolean; regiao_ang: number; regiao_dist: number; whatsapp_proprio: string | null;
  car_codigo: string | null; municipio: string | null; uf: string | null;
  latitude: number | null; longitude: number | null; geojson: any; notas_internas: string | null;
  publicado_em: string | null;
}
export interface AtributoRow {
  chave: string; estado: "confirmado" | "indicado" | "sem_dado"; achado: "detectado" | "nao_detectado" | "indeterminado";
  valor_json: unknown; fonte: string | null; observacao: string | null; confirmado_por: string | null;
  consultado_em: string; publico: boolean;
}
export interface FotoRow { id: number; arquivo: string; legenda: string | null; ordem: number; capa: boolean }
export interface VideoPublico { id: number; youtube_id: string; titulo: string }

export interface AtributoPublico { chave: string; rotulo: string; texto: string; confianca: "confirmado" | "indicado" }
export interface FazendaPublica {
  slug: string; titulo: string; descricao: string; regiao: string; culturas: string[];
  area: string | null; preco: string | null; destaque: boolean;
  capa: string | null; fotos: Array<{ url: string; legenda: string | null }>;
  videos: VideoPublico[];
  atributos: AtributoPublico[]; forma: { d: string; viewBox: string } | null; regiao_mapa: { lat: number; lon: number; raio_km: number } | null; whatsapp: string | null;
}

function textoDoValor(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && typeof (v as any).descricao === "string") return (v as any).descricao.trim() || null;
  return null;
}
function numeroDoValor(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && typeof (v as any).valor === "number") return (v as any).valor;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Texto público de UM atributo, ou null se não pode (ou não deve) aparecer. */
export function atributoParaPublico(a: AtributoRow): AtributoPublico | null {
  const def = defAtributo(a.chave);
  if (!def || !def.publicavel || !a.publico) return null;
  if (a.estado === "sem_dado") return null;
  // Fonte automática só pode afirmar PRESENÇA. "Não detectado" por fonte nunca vira afirmação pública.
  if (a.estado === "indicado" && a.achado !== "detectado") return null;

  let texto: string | null = null;
  if (def.tipo === "numero") {
    const n = numeroDoValor(a.valor_json);
    if (n === null) return null;
    if (a.chave === "declividade_media") texto = classeRelevo(n);
    else if (a.chave.startsWith("logistica_")) texto = faixaDistanciaKm(n);
    else if (def.passoFaixa) texto = faixaNumero(n, def.passoFaixa, def.unidade);
    else return null; // número sem regra de faixa: não expõe exato
  } else {
    texto = textoDoValor(a.valor_json);
  }
  if (!texto) return null;
  return { chave: a.chave, rotulo: def.rotulo, texto, confianca: a.estado === "confirmado" ? "confirmado" : "indicado" };
}

export function projetarFazendaPublica(f: FazendaRow, atributos: AtributoRow[], fotos: FotoRow[], whatsappPadrao = ""): FazendaPublica {
  const fotosOrd = [...fotos].sort((a, b) => Number(b.capa) - Number(a.capa) || a.ordem - b.ordem || a.id - b.id);
  const area = f.area_ha != null && Number(f.area_ha) > 0
    ? (f.area_exibicao === "faixa" ? faixaArea(Number(f.area_ha)) : `${Number(f.area_ha).toLocaleString("pt-BR")} ha`)
    : null;
  return {
    slug: f.slug,
    titulo: f.titulo,
    descricao: f.descricao_publica ?? "",
    regiao: f.regiao_publica ?? "",
    culturas: f.culturas ?? [],
    area,
    preco: f.preco_exibicao || null,
    destaque: f.destaque,
    capa: fotosOrd[0] ? `/uploads/${fotosOrd[0].arquivo}` : null,
    fotos: fotosOrd.map((x) => ({ url: `/uploads/${x.arquivo}`, legenda: x.legenda })),
    videos: [],
    atributos: atributos.map(atributoParaPublico).filter((x): x is AtributoPublico => x !== null),
    forma: f.mostrar_mapa && f.geojson ? formaSvgAnonima(f.geojson) : null,
    regiao_mapa: f.mostrar_regiao ? regiaoAproximada(f.latitude, f.longitude, f.regiao_ang, f.regiao_dist) : null,
    whatsapp: f.whatsapp_proprio || whatsappPadrao || null,
  };
}

/** Problemas que impedem publicar. Lista vazia = pode publicar. */
export function validarPublicacao(f: FazendaRow, fotos: FotoRow[], atributos: AtributoRow[], videos: Array<{ titulo: string; publico: boolean }> = []): string[] {
  const p: string[] = [];
  if (!f.titulo?.trim()) p.push("Falta o título.");
  if (!f.descricao_publica?.trim()) p.push("Falta a descrição pública.");
  if (!f.regiao_publica?.trim()) p.push("Falta a região pública (ex.: 'Norte de Minas Gerais'; não use o município).");
  if (!(f.area_ha != null && Number(f.area_ha) > 0)) p.push("Falta a área (ha).");
  if (fotos.length === 0) p.push("Adicione ao menos uma foto.");
  const priv: DadosPrivados = { municipio: f.municipio, uf: f.uf, car_codigo: f.car_codigo, latitude: f.latitude, longitude: f.longitude };
  const campos: Array<[string, string | null | undefined]> = [
    ["título", f.titulo], ["descrição", f.descricao_publica], ["região", f.regiao_publica], ["preço", f.preco_exibicao],
    ...fotos.map((x, i) => [`legenda da foto ${i + 1}`, x.legenda] as [string, string | null]),
    ...f.culturas.map((c) => ["cultura", c] as [string, string]),
    ...videos.filter(v => v.publico).map(v => ["título do vídeo", v.titulo] as [string, string]),
  ];
  for (const [nome, texto] of campos) for (const m of vazaDadoSensivel(texto, priv)) p.push(`O campo ${nome} ${m}.`);
  for (const a of atributos) {
    if (!a.publico) continue;
    const def = defAtributo(a.chave);
    if (!def?.publicavel) p.push(`O atributo "${def?.rotulo ?? a.chave}" não pode ser público.`);
    else if (a.estado === "sem_dado") p.push(`"${def.rotulo}" está marcado como público mas está sem dado.`);
    else if (def.tipo === "texto") for (const m of vazaDadoSensivel(textoDoValor(a.valor_json), priv)) p.push(`O atributo "${def.rotulo}" ${m}.`);
  }
  if (f.mostrar_mapa && !f.geojson) p.push("O mapa está ligado, mas não há polígono cadastrado.");
  if (f.mostrar_regiao && (f.latitude == null || f.longitude == null)) p.push("O mapa de região está ligado, mas faltam latitude e longitude.");
  return p;
}

// ---------- consultas ----------
export interface FiltrosPublicos {
  regiao?: string; cultura?: string; area_min?: number; area_max?: number;
  altitude_min?: number; altitude_max?: number; argila_min?: number; argila_max?: number;
  relevo?: string; com_agua?: boolean; com_energia?: boolean; ordem?: string;
  limite?: number; deslocamento?: number;
}

export const RELEVOS: Record<string, [number, number]> = {
  plano: [0, 3], "suave ondulado": [3, 8], ondulado: [8, 20], "forte ondulado": [20, 45], montanhoso: [45, 1e6],
};

// Os filtros só enxergam atributos PÚBLICOS e agem sobre a mesma faixa que a vitrine mostra: filtrar não pode
// revelar o valor exato nem dados privados (ex.: afunilar "altitude ≥ 812" para descobrir o número).
const ATTR = (chave: string, cond: string) =>
  `EXISTS (SELECT 1 FROM fazenda_atributos a WHERE a.fazenda_id = f.id AND a.chave = '${chave}' AND a.publico AND a.estado <> 'sem_dado' AND a.achado = 'detectado' AND ${cond})`;
const VAL = "(a.valor_json #>> '{}')::numeric";
const baixo = (v: number, p: number) => Math.floor(v / p) * p;
const alto = (v: number, p: number) => Math.ceil(v / p) * p;
const AREA_LOW = "(CASE WHEN f.area_ha < 100 THEN 0 WHEN f.area_ha < 500 THEN 100 WHEN f.area_ha < 1000 THEN 500 WHEN f.area_ha < 2500 THEN 1000 WHEN f.area_ha < 5000 THEN 2500 WHEN f.area_ha < 10000 THEN 5000 ELSE 10000 END)";
const AREA_HIGH = "(CASE WHEN f.area_ha < 100 THEN 100 WHEN f.area_ha < 500 THEN 500 WHEN f.area_ha < 1000 THEN 1000 WHEN f.area_ha < 2500 THEN 2500 WHEN f.area_ha < 5000 THEN 5000 WHEN f.area_ha < 10000 THEN 10000 ELSE 1e12 END)";

export function montarFiltros(filtros: FiltrosPublicos): { where: string; params: unknown[] } {
  const w: string[] = ["f.status = 'publicada'"];
  const p: unknown[] = [];
  const add = (cond: (n: string) => string, v: unknown) => { p.push(v); w.push(cond(`$${p.length}`)); };
  if (filtros.regiao) add((n) => `f.regiao_publica ILIKE '%' || ${n} || '%'`, filtros.regiao.slice(0, 100));
  if (filtros.cultura) add((n) => `EXISTS (SELECT 1 FROM unnest(f.culturas) c WHERE c ILIKE ${n})`, filtros.cultura.slice(0, 60));
  // Área: exata onde a vitrine mostra o número exato; por faixa onde mostra faixa.
  if (filtros.area_min != null) add((n) => `((f.area_exibicao = 'exata' AND f.area_ha >= ${n}) OR (f.area_exibicao = 'faixa' AND ${AREA_HIGH} > ${n}))`, filtros.area_min);
  if (filtros.area_max != null) add((n) => `((f.area_exibicao = 'exata' AND f.area_ha <= ${n}) OR (f.area_exibicao = 'faixa' AND ${AREA_LOW} < ${n}))`, filtros.area_max);
  const faixaAttr = (chave: string, passo: number, min?: number, max?: number) => {
    const bucket = `floor(${VAL} / ${passo}) * ${passo}`;
    if (min != null) add((n) => ATTR(chave, `${bucket} >= ${n}`), baixo(min, passo));
    if (max != null) add((n) => ATTR(chave, `${bucket} + ${passo} <= ${n}`), alto(max, passo));
  };
  faixaAttr("altitude_media", 100, filtros.altitude_min, filtros.altitude_max);
  faixaAttr("argila_media", 5, filtros.argila_min, filtros.argila_max);
  if (filtros.relevo && RELEVOS[filtros.relevo]) {
    const [lo, hi] = RELEVOS[filtros.relevo];
    p.push(lo, hi);
    w.push(ATTR("declividade_media", `${VAL} >= $${p.length - 1} AND ${VAL} < $${p.length}`));
  }
  if (filtros.com_agua) w.push(ATTR("agua", "TRUE"));
  if (filtros.com_energia) w.push(ATTR("energia", "TRUE"));
  return { where: w.join(" AND "), params: p };
}

async function carregarRelacionados(db: Db, ids: number[]) {
  if (ids.length === 0) return { attrs: new Map<number, AtributoRow[]>(), fotos: new Map<number, FotoRow[]>() };
  const a = await db.query<AtributoRow & { fazenda_id: number }>(`SELECT * FROM fazenda_atributos WHERE fazenda_id = ANY($1::int[])`, [ids]);
  const f = await db.query<FotoRow & { fazenda_id: number }>(`SELECT * FROM fazenda_fotos WHERE fazenda_id = ANY($1::int[]) ORDER BY capa DESC, ordem, id`, [ids]);
  const attrs = new Map<number, AtributoRow[]>(); const fotos = new Map<number, FotoRow[]>();
  for (const r of a.rows) (attrs.get(r.fazenda_id) ?? attrs.set(r.fazenda_id, []).get(r.fazenda_id)!).push(r);
  for (const r of f.rows) (fotos.get(r.fazenda_id) ?? fotos.set(r.fazenda_id, []).get(r.fazenda_id)!).push(r);
  return { attrs, fotos };
}

function ordenacao(ordem?: string): string {
  if (ordem === "maior_area") return "f.area_ha DESC NULLS LAST, f.id DESC";
  if (ordem === "menor_area") return "f.area_ha ASC NULLS LAST, f.id DESC";
  if (ordem === "recentes") return "f.publicado_em DESC NULLS LAST, f.id DESC";
  return "f.destaque DESC, f.destaque_ordem, f.publicado_em DESC NULLS LAST, f.id DESC";
}

export async function listarPublicas(db: Db, filtros: FiltrosPublicos, whatsappPadrao: string) {
  const { where, params } = montarFiltros(filtros);
  const limite = Math.min(Math.max(filtros.limite ?? 24, 1), 60);
  const desloc = Math.max(filtros.deslocamento ?? 0, 0);
  const total = await db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM fazendas f WHERE ${where}`, params);
  const r = await db.query<FazendaRow>(
    `SELECT f.* FROM fazendas f WHERE ${where} ORDER BY ${ordenacao(filtros.ordem)} LIMIT ${limite} OFFSET ${desloc}`,
    params,
  );
  const { attrs, fotos } = await carregarRelacionados(db, r.rows.map((x) => x.id));
  return {
    total: Number(total.rows[0]?.n ?? 0),
    fazendas: r.rows.map((f) => projetarFazendaPublica(f, attrs.get(f.id) ?? [], fotos.get(f.id) ?? [], whatsappPadrao)),
  };
}

export async function obterPublicaPorSlug(db: Db, slug: string, whatsappPadrao: string): Promise<FazendaPublica | null> {
  const r = await db.query<FazendaRow>(`SELECT * FROM fazendas WHERE slug = $1 AND status = 'publicada'`, [slug]);
  const f = r.rows[0];
  if (!f) return null;
  const { attrs, fotos } = await carregarRelacionados(db, [f.id]);
  const publica = projetarFazendaPublica(f, attrs.get(f.id) ?? [], fotos.get(f.id) ?? [], whatsappPadrao);
  publica.videos = (await db.query<VideoPublico>("SELECT id,youtube_id,titulo FROM fazenda_videos WHERE fazenda_id=$1 AND publico ORDER BY ordem,id", [f.id])).rows;
  return publica;
}

/** Opções para os filtros da vitrine (só de fazendas publicadas; região e culturas já são textos públicos). */
export async function opcoesFiltros(db: Db) {
  const reg = await db.query<{ r: string }>(`SELECT DISTINCT regiao_publica AS r FROM fazendas WHERE status='publicada' AND regiao_publica IS NOT NULL ORDER BY 1`);
  const cul = await db.query<{ c: string }>(`SELECT DISTINCT c FROM fazendas f, unnest(f.culturas) c WHERE f.status='publicada' ORDER BY 1`);
  return { regioes: reg.rows.map((x) => x.r), culturas: cul.rows.map((x) => x.c) };
}
