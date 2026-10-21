// Cliente da Hub API (base SICAR espelhada, com altitude e argila). A chave fica SÓ no servidor
// (HUB_API_KEY, uma chave exclusiva do site, separada das do Connect) — nunca vai para o navegador.

export interface HubImovel {
  cod_imovel: string; uf: string | null; municipio: string | null;
  area_ha: number | null; alt_media: number | null; alt_min: number | null; alt_max: number | null;
  argila_media: number | null; geojson: any | null;
}

export type HubResultado<T> = { ok: true; data: T } | { ok: false; motivo: string };

const numero = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Normaliza uma linha da Hub: valores-sentinela (-9999 altitude falhou; -1 argila falhou) viram null. */
export function normalizarImovelHub(r: any): HubImovel {
  const alt = (v: unknown) => { const n = numero(v); return n === null || n <= -9000 ? null : n; };
  const argila = numero(r?.argila_media) ?? numero(r?.argila_pct);
  return {
    cod_imovel: String(r?.cod_imovel ?? ""),
    uf: r?.uf ? String(r.uf).toUpperCase() : null,
    municipio: r?.municipio ? String(r.municipio) : null,
    area_ha: numero(r?.num_area),
    alt_media: alt(r?.alt_media), alt_min: alt(r?.alt_min), alt_max: alt(r?.alt_max),
    argila_media: argila !== null && argila >= 0 && argila <= 100 ? argila : null,
    geojson: r?.geojson ?? null,
  };
}

export interface FiltrosHub {
  uf?: string; area_min?: number; area_max?: number;
  alt_media_min?: number; alt_media_max?: number; argila_media_min?: number; argila_media_max?: number;
  limite?: number; deslocamento?: number;
}

export interface Hub {
  configurado(): boolean;
  buscarPorCodigo(cod: string): Promise<HubResultado<HubImovel | null>>;
  buscar(f: FiltrosHub): Promise<HubResultado<{ total: number; imoveis: HubImovel[] }>>;
}

export function criarHub(opts: { baseUrl?: string; apiKey?: string; fetchFn?: typeof fetch } = {}): Hub {
  const base = (opts.baseUrl ?? process.env.HUB_API_URL ?? "https://api.mavrionconnect.com.br").replace(/\/+$/, "");
  const key = opts.apiKey ?? process.env.HUB_API_KEY ?? "";
  const f = opts.fetchFn ?? fetch;

  async function get(path: string, params: Record<string, string | number | undefined>): Promise<HubResultado<any>> {
    if (!key) return { ok: false, motivo: "Hub API não configurada (falta HUB_API_KEY)." };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
    try {
      const r = await f(`${base}${path}?${q}`, { headers: { "x-api-key": key }, signal: AbortSignal.timeout(25000) });
      if (r.status === 401) return { ok: false, motivo: "Hub API recusou a chave (HUB_API_KEY inválida)." };
      if (r.status === 202) return { ok: false, motivo: "Hub API ainda está preparando o cache. Tente em alguns minutos." };
      if (!r.ok) return { ok: false, motivo: `Hub API respondeu ${r.status}.` };
      return { ok: true, data: await r.json() };
    } catch (e: any) {
      return { ok: false, motivo: `Hub API indisponível (${e?.name === "TimeoutError" ? "tempo esgotado" : "falha de rede"}).` };
    }
  }

  return {
    configurado: () => !!key,
    async buscarPorCodigo(cod) {
      const r = await get("/api/sicar/imoveis", { cod_imovel: cod, include_geometry: "true", limit: 5 });
      if (!r.ok) return r;
      const alvo = String(cod).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
      const achado = (r.data?.data ?? []).find((x: any) => String(x?.cod_imovel ?? "").replace(/[^A-Za-z0-9]/g, "").toLowerCase() === alvo);
      return { ok: true, data: achado ? normalizarImovelHub(achado) : null };
    },
    async buscar(filtros) {
      const r = await get("/api/sicar/imoveis", {
        uf: filtros.uf, area_min: filtros.area_min, area_max: filtros.area_max,
        alt_media_min: filtros.alt_media_min, alt_media_max: filtros.alt_media_max,
        argila_media_min: filtros.argila_media_min, argila_media_max: filtros.argila_media_max,
        limit: Math.min(filtros.limite ?? 20, 50), offset: filtros.deslocamento ?? 0,
        sort: "num_area", order: "desc",
      });
      if (!r.ok) return r;
      return { ok: true, data: { total: Number(r.data?.total) || 0, imoveis: (r.data?.data ?? []).map(normalizarImovelHub) } };
    },
  };
}
