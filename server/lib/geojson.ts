/** Aceita só Polygon/MultiPolygon com coordenadas numéricas válidas. Devolve a geometria limpa ou null. */
export function validarGeoJsonPoligono(entrada: unknown): any | null {
  let g: any = entrada;
  if (typeof g === "string") { try { g = JSON.parse(g); } catch { return null; } }
  if (g?.type === "Feature") g = g.geometry;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon") || !Array.isArray(g.coordinates)) return null;
  const okPar = (p: any) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= -180 && p[0] <= 180 && p[1] >= -90 && p[1] <= 90;
  const okAnel = (a: any) => Array.isArray(a) && a.length >= 4 && a.every(okPar);
  const okPoly = (poly: any) => Array.isArray(poly) && poly.length >= 1 && poly.every(okAnel);
  const ok = g.type === "Polygon" ? okPoly(g.coordinates) : g.coordinates.length > 0 && g.coordinates.every(okPoly);
  if (!ok) return null;
  if (JSON.stringify(g).length > 2_000_000) return null;
  return { type: g.type, coordinates: g.coordinates };
}

/** Centro aproximado (média dos vértices do 1º anel externo) — só como ponto de referência privado. */
export function centroAproximado(g: any): { lat: number; lon: number } | null {
  const anel = g?.type === "Polygon" ? g.coordinates?.[0] : g?.type === "MultiPolygon" ? g.coordinates?.[0]?.[0] : null;
  if (!Array.isArray(anel) || anel.length === 0) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of anel) { sx += x; sy += y; }
  return { lat: sy / anel.length, lon: sx / anel.length };
}
