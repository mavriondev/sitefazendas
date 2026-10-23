export interface ConfigRastreamento {
  ga4_id: string; ga4_ativo: boolean; meta_pixel_id: string; meta_pixel_ativo: boolean;
}
export const rastreamentoPadrao = (): ConfigRastreamento => ({
  ga4_id: "", ga4_ativo: false, meta_pixel_id: "", meta_pixel_ativo: false,
});
// Não pertence à lista de páginas medidas automaticamente: exige nova autorização.
export const CAMINHO_DIAGNOSTICO = "/diagnostico-rastreamento";
export const idGa4Valido = (s: string) => /^G-[A-Z0-9]{4,20}$/.test(s);
export const idPixelValido = (s: string) => /^[0-9]{5,25}$/.test(s);
export function validarRastreamento(c: any): string | null {
  if (!c || typeof c !== "object" || Array.isArray(c) ||
    Object.keys(c).sort().join() !== Object.keys(rastreamentoPadrao()).sort().join() ||
    typeof c.ga4_ativo !== "boolean" || typeof c.meta_pixel_ativo !== "boolean" ||
    typeof c.ga4_id !== "string" || typeof c.meta_pixel_id !== "string") return "Configuração de rastreamento inválida.";
  if ((c.ga4_id || c.ga4_ativo) && !idGa4Valido(c.ga4_id)) return "Informe o ID do Google Analytics 4 no formato G-XXXXXXXXXX, sem scripts.";
  if ((c.meta_pixel_id || c.meta_pixel_ativo) && !idPixelValido(c.meta_pixel_id)) return "Informe somente os números do ID do Pixel da Meta, sem scripts.";
  return null;
}
// Nunca medir painel, autenticação, pesquisa por CAR, conta ou ficha de impressão.
export const caminhoRastreavel = (s: string) =>
  ["/", "/fazendas", "/sobre", "/parceiros", "/contato", "/venda-sua-fazenda", "/privacidade"].includes(s) ||
  /^\/fazenda\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
export const CHAVE_CONSENTIMENTO = "gramogol:consentimento:v1";
export const DURACAO_CONSENTIMENTO = 180 * 24 * 60 * 60 * 1000;
export interface Consentimento { versao: 1; analytics: boolean; marketing: boolean; expira: number }
export function lerConsentimento(s: string | null, agora = Date.now()): Consentimento | null {
  try {
    const c = JSON.parse(s || "null");
    return c?.versao === 1 && typeof c.analytics === "boolean" && typeof c.marketing === "boolean" &&
      Number.isFinite(c.expira) && c.expira > agora && c.expira <= agora + DURACAO_CONSENTIMENTO + 60000 ? c : null;
  } catch { return null; }
}
