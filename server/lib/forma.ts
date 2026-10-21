// Forma anonimizada da fazenda: contorno desenhado SEM mapa, SEM coordenadas, SEM escala e SEM orientação
// geográfica reconhecível (é normalizado para caber numa caixa de 100x100). Serve só para o visitante ver
// o "formato" do terreno. É opção por fazenda (padrão: desligada).

type Par = [number, number];

function aneisDe(geojson: any): Par[][] {
  const g = geojson?.geometry || geojson;
  if (!g?.coordinates) return [];
  const limpa = (r: any): Par[] =>
    Array.isArray(r) ? r.filter((p: any) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p: any) => [p[0], p[1]] as Par) : [];
  if (g.type === "Polygon") return [limpa(g.coordinates[0])].filter((r) => r.length >= 4);
  if (g.type === "MultiPolygon") return g.coordinates.map((p: any) => limpa(p?.[0])).filter((r: Par[]) => r.length >= 4);
  return [];
}

function simplificar(pontos: Par[], max: number): Par[] {
  if (pontos.length <= max) return pontos;
  const passo = pontos.length / max;
  const out: Par[] = [];
  for (let i = 0; i < max; i++) out.push(pontos[Math.floor(i * passo)]);
  return out;
}

/** Devolve um `d` de path SVG (viewBox "0 0 100 100") ou null se não houver polígono válido. */
export function formaSvgAnonima(geojson: any, maxPontos = 120): { d: string; viewBox: string } | null {
  const aneis = aneisDe(geojson);
  if (aneis.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of aneis) for (const [x, y] of a) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const latMedia = (minY + maxY) / 2;
  const kx = Math.cos((latMedia * Math.PI) / 180); // evita achatar a forma
  const w = (maxX - minX) * kx;
  const h = maxY - minY;
  const escala = 92 / Math.max(w, h, 1e-12);
  const offX = (100 - w * escala) / 2;
  const offY = (100 - h * escala) / 2;
  const partes = aneis.map((a) => {
    const pts = simplificar(a, maxPontos).map(([x, y]) => {
      const px = offX + (x - minX) * kx * escala;
      const py = offY + (maxY - y) * escala; // y invertido (norte para cima)
      return `${px.toFixed(1)} ${py.toFixed(1)}`;
    });
    return `M${pts.join("L")}Z`;
  });
  return { d: partes.join(""), viewBox: "0 0 100 100" };
}
