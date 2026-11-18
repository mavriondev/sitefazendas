export interface ParceiroPublico { id: number; nome: string; logo: string | null; url: string | null }

/** Também cobre destinos editoriais com query, barra final ou âncora. */
export function destinoParceiros(href: string): boolean {
  try {
    const url = new URL(href, "https://portal.invalid");
    return /^\/parceiros(?:\/|$)/i.test(url.pathname) || url.hash.toLowerCase() === "#parceiros";
  } catch { return false; }
}

export function parceirosDisponiveis(lista: ParceiroPublico[], paginas: Record<string, { ocultas: string[] }>): boolean {
  return lista.length > 0 && !!paginas.home && !!paginas.parceiros &&
    !paginas.home.ocultas.includes("parceiros") && !paginas.parceiros.ocultas.includes("lista");
}
