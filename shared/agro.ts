export type FonteAgro = "mapa" | "canal-rural";
export interface NoticiaAgro {
  id: number;
  slug: string;
  titulo: string;
  chamada: string;
  resumo: string;
  resumo_fonte: string;
  corpo: string[];
  fonte: FonteAgro;
  fonte_nome: string;
  fonte_url: string;
  autor: string;
  publicado_em: string | null;
  importado_em: string;
  formato: "integral" | "resumo";
  licenca: string | null;
  ativo: boolean;
  ordem: number;
}
export interface ConfigAgro {
  noticias_ativas: boolean;
  cotacoes_ativas: boolean;
  mapa_ativo: boolean;
  canal_rural_ativo: boolean;
}
export const CONFIG_AGRO_PADRAO: ConfigAgro = {
  noticias_ativas: true, cotacoes_ativas: true, mapa_ativo: true, canal_rural_ativo: true,
};
export interface NoticiasAgroResposta {
  noticias: NoticiaAgro[];
  pagina: number;
  total: number;
  paginas: number;
}
export interface CotacaoDolar {
  valor: number;
  anterior: number | null;
  variacao: number | null;
  data: string;
  consultado_em: string;
  desatualizado: boolean;
  fonte: "Banco Central do Brasil";
}
export interface EstadoAgro {
  atualizado_em: string | null;
  falhas: string[];
}
export interface AgroPublico {
  config: ConfigAgro;
  dolar: CotacaoDolar | null;
  estado: EstadoAgro;
}
export interface AgroAdmin extends AgroPublico {
  noticias: NoticiaAgro[];
}
export const WIDGETS_AGRO = [
  { id: "127", nome: "Soja", mercado: "Mercado físico · preços por praça" },
  { id: "130", nome: "Milho", mercado: "Mercado físico · preços por praça" },
  { id: "28", nome: "Café", mercado: "Arábica tipo 6 · bebida dura · bica corrida" },
  { id: "120", nome: "Boi gordo", mercado: "Média de São Paulo · a prazo" },
] as const;
