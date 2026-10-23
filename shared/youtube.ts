/** Só armazenamos o identificador, nunca HTML ou URLs arbitrárias de incorporação. */
export function idYoutube(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  const valor = entrada.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(valor)) return valor;
  try {
    const u = new URL(valor);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password || u.port) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else id = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
