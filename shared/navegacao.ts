/** O retorno do login nunca pode sair do portal, nem usando barras codificadas. */
export function retornoSeguro(valor: string | null): string {
  if (!valor || valor.length > 2000) return "/";
  const inseguro = (v: string) => !v.startsWith("/") || v.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(v);
  let decodificado = valor;
  try {
    for (let i = 0; i < 4; i++) {
      if (inseguro(decodificado)) return "/";
      const proximo = decodeURIComponent(decodificado);
      if (proximo === decodificado) break;
      decodificado = proximo;
    }
    const url = new URL(valor, "https://portal.invalid");
    if (url.origin !== "https://portal.invalid" || inseguro(url.pathname)) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}
