import type { Db } from "./db";

export interface ConfigSite {
  nome_site: string;
  whatsapp_padrao: string;
  texto_creci: string;
  aviso_intermediacao: string;
  hero_titulo: string;
  hero_subtitulo: string;
  sobre_titulo: string;
  sobre_texto: string;
  contato_email: string;
  contato_endereco: string;
  contato_horario: string;
  instagram_url: string;
  /** Interruptor do módulo B (pesquisa de terras). Desligado por padrão. */
  modulo_pesquisa_ativo: boolean;
  /** Limite de consultas por usuário por hora no módulo B. */
  pesquisa_limite_hora: number;
}

export const CONFIG_PADRAO: ConfigSite = {
  nome_site: "Gramogol Fazendas",
  whatsapp_padrao: "",
  texto_creci: "",
  aviso_intermediacao:
    "As informações são indicativas, obtidas de fontes públicas e do vendedor, e não substituem a verificação documental. O acesso ao imóvel e aos dados completos é feito exclusivamente por intermediação.",
  hero_titulo: "Fazendas selecionadas",
  hero_subtitulo: "Terras com dados verificados e atendimento direto.",
  sobre_titulo: "Sobre nós",
  sobre_texto:
    "Somos uma equipe especializada na intermediação de fazendas e propriedades rurais.\n\nApresentamos cada propriedade com dados claros e a indicação de onde cada informação vem: o que foi confirmado com o vendedor, em documento ou em visita, e o que vem de bases públicas e modelos.\n\nPor proteção dos proprietários, a localização exata, o código do CAR e os limites das propriedades só são informados em atendimento direto.",
  contato_email: "",
  contato_endereco: "",
  contato_horario: "",
  instagram_url: "",
  modulo_pesquisa_ativo: false,
  pesquisa_limite_hora: 30,
};

const CHAVES = Object.keys(CONFIG_PADRAO) as Array<keyof ConfigSite>;

export async function lerConfig(db: Db): Promise<ConfigSite> {
  const r = await db.query<{ chave: string; valor: unknown }>("SELECT chave, valor FROM configuracoes");
  const cfg: Record<string, unknown> = { ...CONFIG_PADRAO };
  for (const row of r.rows) if ((CHAVES as string[]).includes(row.chave)) cfg[row.chave] = row.valor;
  return cfg as unknown as ConfigSite;
}

/** Valida e grava só chaves conhecidas, com o tipo certo. Devolve erro (texto) ou null. */
export async function gravarConfig(db: Db, parcial: Record<string, unknown>): Promise<string | null> {
  for (const [k, v] of Object.entries(parcial)) {
    if (!(CHAVES as string[]).includes(k)) return `configuração desconhecida: ${k}`;
    const tipoEsperado = typeof CONFIG_PADRAO[k as keyof ConfigSite];
    if (typeof v !== tipoEsperado) return `${k} deve ser ${tipoEsperado}`;
    if (typeof v === "string" && v.length > 8000) return `${k} muito longo`;
    if (k === "instagram_url" && v && !/^https:\/\//i.test(v as string)) return "instagram_url deve começar com https://";
    if (k === "pesquisa_limite_hora" && (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 1000)) return "pesquisa_limite_hora deve ser inteiro de 1 a 1000";
  }
  for (const [k, v] of Object.entries(parcial)) {
    await db.query(
      `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2::jsonb)
       ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`,
      [k, JSON.stringify(v)],
    );
  }
  return null;
}
