export const PAGINAS_SEO = [
  { caminho: "/", nome: "Página inicial" }, { caminho: "/fazendas", nome: "Catálogo de fazendas" },
  { caminho: "/sobre", nome: "Sobre" }, { caminho: "/parceiros", nome: "Parceiros" },
  { caminho: "/contato", nome: "Contato" }, { caminho: "/venda-sua-fazenda", nome: "Venda sua fazenda" },
  { caminho: "/privacidade", nome: "Política de privacidade" },
];
export interface PaginaSeo { titulo: string; descricao: string; imagem: string; nao_indexar: boolean }
export interface ConfigSeo {
  revisao: number; url_base: string; titulo_padrao: string; descricao_padrao: string;
  imagem_padrao: string; google_verificacao: string; bing_verificacao: string;
  bloquear_indexacao: boolean; paginas: Record<string, PaginaSeo>;
}
export const paginaSeoVazia = (): PaginaSeo => ({ titulo: "", descricao: "", imagem: "", nao_indexar: false });
export const seoPadrao = (): ConfigSeo => ({
  revisao: 0, url_base: "", titulo_padrao: "", descricao_padrao: "", imagem_padrao: "",
  google_verificacao: "", bing_verificacao: "", bloquear_indexacao: false, paginas: {},
});
export interface MetaSeo {
  titulo: string; descricao: string; imagem: string; canonical: string; indexar: boolean;
  status: number; google: string; bing: string; nome_site: string;
}
