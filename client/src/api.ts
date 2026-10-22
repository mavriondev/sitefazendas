export class ErroApi extends Error {
  constructor(public status: number, mensagem: string, public detalhes?: string[]) { super(mensagem); }
}

async function chamar<T>(metodo: string, url: string, corpo?: unknown, form?: FormData): Promise<T> {
  const r = await fetch(url, {
    method: metodo,
    credentials: "same-origin",
    headers: form || corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: form ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
  });
  let j: any = null;
  try { j = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) throw new ErroApi(r.status, j?.message ?? "Erro inesperado. Tente novamente.", j?.problemas);
  return j as T;
}

export const api = {
  get: <T = any>(u: string) => chamar<T>("GET", u),
  post: <T = any>(u: string, b?: unknown) => chamar<T>("POST", u, b ?? {}),
  put: <T = any>(u: string, b?: unknown) => chamar<T>("PUT", u, b ?? {}),
  del: <T = any>(u: string) => chamar<T>("DELETE", u),
  upload: <T = any>(u: string, arquivo: File, campos: Record<string, string> = {}) => {
    const f = new FormData();
    f.append("arquivo", arquivo);
    for (const [k, v] of Object.entries(campos)) f.append(k, v);
    return chamar<T>("POST", u, undefined, f);
  },
};

export interface Usuario { nome: string; email: string; papel: "comprador" | "admin"; nivel_acesso: "aberto" | "desbloqueado" | "completo" }
export interface ConfigPublica {
  nome_site: string; whatsapp_padrao: string; texto_creci: string; aviso_intermediacao: string;
  hero_titulo: string; hero_subtitulo: string; modulo_pesquisa_ativo: boolean;
  sobre_titulo: string; sobre_texto: string; contato_email: string; contato_endereco: string; contato_horario: string; instagram_url: string;
}
export interface AtributoPublico { chave: string; rotulo: string; texto: string; confianca: "confirmado" | "indicado" }
export interface FazendaPublica {
  slug: string; titulo: string; descricao: string; regiao: string; culturas: string[]; area: string | null; preco: string | null;
  destaque: boolean; capa: string | null; fotos: Array<{ url: string; legenda: string | null }>;
  atributos: AtributoPublico[]; forma: { d: string; viewBox: string } | null;
  videos: Array<{ id: number; youtube_id: string; titulo: string }>;
  regiao_mapa: { lat: number; lon: number; raio_km: number } | null; whatsapp: string | null;
}

export const soDigitos = (s: string) => s.replace(/\D/g, "");
export function linkWhatsapp(numero: string | null | undefined, texto: string): string | null {
  const d = numero ? soDigitos(numero) : "";
  if (d.length < 10) return null;
  const completo = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${completo}?text=${encodeURIComponent(texto)}`;
}
