import { createHash } from "node:crypto";
import type { Db } from "../db";

/** Limpeza editorial pontual; nunca aplicada automaticamente ao ler ou salvar. */
export function limparMarcacoesDemo(texto: string): string {
  const limpo = texto
    .replace(/^\s*Endereço fictício\s*[—–-]\s*substitua no painel\s*$/i, "")
    .replace(/\[(?:EXEMPLO|DEMO)\]\s*/gi, "")
    .replace(/ANÚNCIO FICTÍCIO PARA TESTES\s*[—–-]\s*não representa uma propriedade disponível para compra\.\s*/gi, "")
    .replace(/Anúncio fictício para desenvolvimento: não representa um imóvel à venda\.\s*/gi, "")
    .replace(/Fazenda de demonstração para simular (.+?) e testar os filtros do catálogo\./gi, "Fazenda com vocação para $1.")
    .replace(/Área, preço e características são inventados; as fotos são paisagens ilustrativas\.\s*/gi, "")
    .replace(/Área, preço, características e infraestrutura são inteiramente simulados, sem verificação documental\.\s*/gi, "")
    .replace(/As fotografias são paisagens ilustrativas, não imagens deste imóvel\.\s*/gi, "")
    .replace(/Não há CAR, município ou localização real cadastrados\.\s*/gi, "")
    .replace(/Foto ilustrativa de exemplo\s*[—–-]\s*não é a propriedade\.?\s*/gi, "")
    .replace(/Foto ilustrativa de paisagem\.\s*O anúncio e os dados são fictícios para testes\.\s*/gi, "")
    .replace(/Este é um texto de exemplo para a página Sobre\.\s*Troque-o em Painel\s*→\s*Configurações antes de divulgar o site\.\s*/gi, "")
    .replace(/Slide de exemplo sem link para fazenda\.\s*Substitua no painel\.?/gi, "")
    .replace(/Slide de exemplo: fazenda fictícia com\s*/gi, "Fazenda com ")
    .replace(/Slide de exemplo:\s*/gi, "")
    .replace(/propriedade fictícia para testar o carrossel\.?/gi, "Conheça os detalhes desta propriedade.")
    .replace(/\s+para testar o carrossel\.?/gi, ".")
    .replace(/\s*\((?:(?:valor de )?exemplo|demonstração|fictíci[oa]s?)\)/gi, "")
    .replace(/\s+simulad[oa]s? para testes/gi, "")
    .replace(/\bAtividade fictícia:\s*/gi, "Atividade: ")
    .replace(/\bfictíci[oa]s?\s*/gi, "")
    .replace(/^\s*Image(?:m|ns) ilustrativas?\s*$/i, "");
  if (limpo === texto) return texto;
  return limpo
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const camposTecnicos = new Set(["rastreamento","analytics","pixel","url","href","src","slug","imagem","logo","link","whatsapp","email","canonical_url"]);
export function limparTextosEditoriais(v: unknown): unknown {
  if (typeof v === "string") {
    if (/^(?:https?:\/\/|\/|mailto:|tel:|data:)/i.test(v)) return v;
    return limparMarcacoesDemo(v);
  }
  if (Array.isArray(v)) return v.map(limparTextosEditoriais);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, camposTecnicos.has(k) ? x : limparTextosEditoriais(x)]));
  return v;
}

type Tabela = "fazendas" | "fazenda_fotos" | "fazenda_atributos" | "slides" | "parceiros" | "configuracoes";
export type MudancaApresentacao = { tabela: Tabela; id: number | string; coluna: string; antes: unknown; depois: unknown };
const permitidos: Record<Tabela, readonly string[]> = {
  fazendas: ["titulo","descricao_publica","regiao_publica","preco_exibicao"],
  fazenda_fotos: ["legenda"],
  fazenda_atributos: ["valor_json"],
  slides: ["titulo","subtitulo"],
  parceiros: ["nome"],
  configuracoes: ["valor"],
};
const configEditorial = new Set(["nome_site","hero_titulo","hero_subtitulo","sobre_titulo","sobre_texto","contato_endereco","contato_horario","aviso_intermediacao","texto_creci","conteudo_site","seo_site"]);

export async function planejarApresentacao(db: Db): Promise<MudancaApresentacao[]> {
  const plano: MudancaApresentacao[] = [];
  const incluir = (tabela: Tabela, id: number|string, coluna: string, antes: unknown, depois: unknown) => {
    if (JSON.stringify(antes) === JSON.stringify(depois)) return;
    if ((coluna === "titulo" || coluna === "nome") && !depois) throw new Error("A limpeza deixaria um título vazio.");
    plano.push({tabela,id,coluna,antes,depois});
  };
  const fazendas = await db.query<{id:number;slug:string;titulo:string;descricao_publica:string|null;regiao_publica:string|null;preco_exibicao:string|null}>(
    "SELECT id,slug,titulo,descricao_publica,regiao_publica,preco_exibicao FROM fazendas ORDER BY id");
  const ids: number[] = [];
  for (const f of fazendas.rows) {
    if (!/\[(?:EXEMPLO|DEMO)\]/i.test(f.titulo) && !/^(?:exemplo|demo)-/.test(f.slug)) continue;
    ids.push(f.id);
    for (const coluna of permitidos.fazendas) {
      const antes = f[coluna as keyof typeof f];
      if (typeof antes === "string") incluir("fazendas", f.id, coluna, antes, limparMarcacoesDemo(antes));
    }
  }
  if (ids.length) {
    const fotos = await db.query<{id:number;legenda:string|null}>("SELECT id,legenda FROM fazenda_fotos WHERE fazenda_id=ANY($1::int[]) ORDER BY id",[ids]);
    for (const f of fotos.rows) if (f.legenda) incluir("fazenda_fotos",f.id,"legenda",f.legenda,limparMarcacoesDemo(f.legenda)||null);
    const atributos = await db.query<{id:number;valor_json:unknown}>("SELECT id,valor_json FROM fazenda_atributos WHERE fazenda_id=ANY($1::int[]) AND publico ORDER BY id",[ids]);
    for (const a of atributos.rows) if (typeof a.valor_json === "string") incluir("fazenda_atributos",a.id,"valor_json",a.valor_json,limparMarcacoesDemo(a.valor_json));
  }
  for (const tabela of ["slides","parceiros"] as const) {
    const r = await db.query<Record<string,unknown>>(`SELECT id,${permitidos[tabela].join(",")} FROM ${tabela} ORDER BY id`);
    for (const linha of r.rows) for (const coluna of permitidos[tabela]) {
      const antes = linha[coluna];
      if (typeof antes === "string") incluir(tabela,linha.id as number,coluna,antes,limparMarcacoesDemo(antes));
    }
  }
  const cfg = await db.query<{chave:string;valor:unknown}>("SELECT chave,valor FROM configuracoes ORDER BY chave");
  for (const c of cfg.rows) if (configEditorial.has(c.chave)) incluir("configuracoes",c.chave,"valor",c.valor,limparTextosEditoriais(c.valor));
  return plano;
}

export const hashApresentacao = (plano: MudancaApresentacao[]) => createHash("sha256").update(JSON.stringify(plano)).digest("hex");

/** Chamar dentro de transação; aborta se um campo tiver sido editado desde o plano. */
export async function aplicarApresentacao(db: Db, plano: MudancaApresentacao[]) {
  for (const m of plano) {
    if (!permitidos[m.tabela]?.includes(m.coluna)) throw new Error("Campo fora do escopo editorial.");
    const json = m.coluna === "valor_json" || m.coluna === "valor";
    const chave = m.tabela === "configuracoes" ? "chave" : "id";
    const r = await db.query(`UPDATE ${m.tabela} SET ${m.coluna}=$1${json ? "::jsonb" : ""}${m.tabela === "fazendas" ? ", atualizado_em=now()" : ""} WHERE ${chave}=$2 AND ${m.coluna} IS NOT DISTINCT FROM $3${json ? "::jsonb" : ""}`,
      [json ? JSON.stringify(m.depois) : m.depois,m.id,json ? JSON.stringify(m.antes) : m.antes]);
    if (r.rowCount !== 1) throw new Error("Conteúdo mudou desde a conferência. Gere outro plano; nada deve ser sobrescrito.");
  }
}
