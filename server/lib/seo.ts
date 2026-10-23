import type { Db } from "../db";
import { lerConfig } from "../config";
import { lerConteudo } from "./conteudo";
import { obterPublicaPorSlug } from "./publico";
import { PAGINAS_SEO, seoPadrao, type ConfigSeo, type MetaSeo } from "../../shared/seo";

const CAMINHO_FAZENDA = /^\/fazenda\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const imagemValida = (s: string) => !s || /^\/(?:images\/gramogol\/[\w-]+\.(?:jpg|jpeg|png|webp)|uploads\/[a-f0-9]{32}\.(?:jpg|png))$/.test(s);
export const caminhoSeoValido = (s: string) => PAGINAS_SEO.some(p => p.caminho === s) || (s.length <= 250 && CAMINHO_FAZENDA.test(s));
export const escaparSeo = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
export function origemSeo(s: string, permitirHttp = false): string {
  try {
    const u = new URL(s);
    if ((!permitirHttp && u.protocol !== "https:") || (permitirHttp && !["https:","http:"].includes(u.protocol)) || u.username || u.password || u.search || u.hash || u.pathname !== "/") return "";
    return u.origin;
  } catch { return ""; }
}
export async function lerSeo(db: Db): Promise<ConfigSeo> {
  const r = await db.query<{valor:ConfigSeo}>("SELECT valor FROM configuracoes WHERE chave='seo_site'");
  return { ...seoPadrao(), ...r.rows[0]?.valor };
}
export function validarSeo(b: any): string | null {
  if (!b || typeof b !== "object" || Array.isArray(b) || !Number.isSafeInteger(b.revisao) || b.revisao < 0 ||
    Object.keys(b).sort().join() !== Object.keys(seoPadrao()).sort().join()) return "Configuração de SEO inválida. Atualize a página.";
  for (const [k,limite] of Object.entries({url_base:200,titulo_padrao:160,descricao_padrao:320,imagem_padrao:250,google_verificacao:200,bing_verificacao:200})) {
    if (typeof b[k] !== "string" || b[k].length > limite || /[\u0000-\u001f\u007f]/.test(b[k])) return `Valor inválido: ${k}.`;
  }
  if (b.url_base && (!origemSeo(b.url_base) || /[\s\\]/.test(b.url_base))) return "Informe somente a origem HTTPS do domínio, sem caminho, parâmetros ou credenciais.";
  if (!imagemValida(b.imagem_padrao)) return "Selecione uma imagem da biblioteca de SEO.";
  if ([b.google_verificacao,b.bing_verificacao].some(v => v && !/^[A-Za-z0-9_-]+$/.test(v))) return "Informe apenas o código de verificação, sem tags HTML.";
  if (typeof b.bloquear_indexacao !== "boolean" || !b.paginas || typeof b.paginas !== "object" || Array.isArray(b.paginas) || Object.keys(b.paginas).length > 2000) return "Páginas de SEO inválidas.";
  for (const [c,p] of Object.entries(b.paginas) as [string,any][]) {
    if (!caminhoSeoValido(c) || !p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).sort().join() !== "descricao,imagem,nao_indexar,titulo" ||
      typeof p.titulo !== "string" || p.titulo.length > 160 || typeof p.descricao !== "string" || p.descricao.length > 320 ||
      typeof p.imagem !== "string" || p.imagem.length > 250 || !imagemValida(p.imagem) || typeof p.nao_indexar !== "boolean" ||
      [p.titulo,p.descricao].some(v => /[\u0000-\u001f\u007f]/.test(v))) return `SEO inválido para ${c}.`;
  }
  return null;
}
export function imagensSeo(s: ConfigSeo): string[] {
  return [...new Set([s.imagem_padrao,...Object.values(s.paginas).map(p=>p.imagem)].filter(v=>v.startsWith("/uploads/")).map(v=>v.slice(9)))];
}
export async function resolverSeo(db: Db, caminho: string, siteUrl?: string): Promise<MetaSeo> {
  if(caminho.length>1) caminho=caminho.replace(/\/+$/,"");
  const [seo,cfg,conteudo] = await Promise.all([lerSeo(db),lerConfig(db),lerConteudo(db)]);
  const base = origemSeo(seo.url_base) || origemSeo(siteUrl || "", true);
  const pagina = seo.paginas[caminho];
  const fixo = PAGINAS_SEO.find(p=>p.caminho===caminho);
  const ids: Record<string,string> = {"/sobre":"sobre","/parceiros":"parceiros","/contato":"contato","/venda-sua-fazenda":"venda","/fazendas":"catalogo","/privacidade":"privacidade"};
  const valores = conteudo.paginas[ids[caminho]]?.valores || {};
  const fazenda = CAMINHO_FAZENDA.test(caminho) ? await obterPublicaPorSlug(db,caminho.slice(9),cfg.whatsapp_padrao) : null;
  const publico = !!fixo || !!fazenda;
  const tituloNatural = fazenda?.titulo || (caminho==="/sobre" ? cfg.sobre_titulo : valores["topo.titulo"]) || fixo?.nome || "Página não encontrada";
  const restrito = /^\/(?:admin(?:\/|$)|entrar$|cadastro$|conta$|redefinir-senha$|pesquisa$)/.test(caminho);
  const titulo = publico ? (pagina?.titulo || (caminho==="/" ? seo.titulo_padrao || `${cfg.nome_site} | Fazendas à venda` : `${tituloNatural} | ${cfg.nome_site}`)) : `${restrito?"Acesso restrito":"Página não encontrada"} | ${cfg.nome_site}`;
  const descricao = publico ? pagina?.descricao || (fazenda?.descricao || valores["topo.texto"] || seo.descricao_padrao || `Conheça a ${cfg.nome_site}. Fazendas à venda e atendimento especializado em imóveis rurais.`).replace(/\s+/g," ").slice(0,320) : "";
  const foto = publico ? pagina?.imagem || fazenda?.capa || seo.imagem_padrao || conteudo.paginas.home.valores["hero.imagem"] : "";
  return {
    titulo,descricao,imagem:foto&&base ? base+foto : "",canonical:publico&&base ? base+caminho : "",
    indexar:publico&&!seo.bloquear_indexacao&&!pagina?.nao_indexar,status:publico||restrito?200:404,
    google:publico?seo.google_verificacao:"",bing:publico?seo.bing_verificacao:"",nome_site:cfg.nome_site,
  };
}
export function tagsSeo(m: MetaSeo): string {
  const meta = (name:string,value:string,property=false) => value ? `<meta ${property?"property":"name"}="${name}" content="${escaparSeo(value)}">` : "";
  const tags = [
    `<title>${escaparSeo(m.titulo)}</title>`,meta("description",m.descricao),
    meta("robots",m.indexar?"index, follow":"noindex, nofollow"),
    m.canonical ? `<link rel="canonical" href="${escaparSeo(m.canonical)}">` : "",
    meta("og:type","website",true),meta("og:locale","pt_BR",true),meta("og:site_name",m.nome_site,true),
    ...["title","description","image","url"].map((key,i)=>meta(`og:${key}`,[m.titulo,m.descricao,m.imagem,m.canonical][i],true)),
    meta("twitter:card",m.imagem?"summary_large_image":"summary"),
    ...["title","description","image"].map((key,i)=>meta(`twitter:${key}`,[m.titulo,m.descricao,m.imagem][i])),
    meta("google-site-verification",m.google),meta("msvalidate.01",m.bing),
  ];
  if (m.canonical) tags.push(`<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"WebPage",name:m.titulo,description:m.descricao,url:m.canonical}).replace(/</g,"\\u003c")}</script>`);
  return tags.filter(Boolean).join("\n");
}
