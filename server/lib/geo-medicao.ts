// Medições geográficas puras (sem rede) — testáveis sem API.
//
// Por que existe: o cálculo antigo em routes/geo.ts amostrava a altitude só nos vértices do
// CONTORNO, media a distância a partir do CENTRO até os VÉRTICES das linhas e tratava
// "qualquer linha num raio de ~11 km" como "tem rio/energia". Aqui:
//  - amostra pontos no INTERIOR do polígono;
//  - distância é da BORDA do imóvel até a feição (0 quando toca ou está dentro);
//  - declividade vem de vizinhos próximos, não de cordas do perímetro;
//  - o score ignora categorias sem dado (ausência de dado não é nota zero).
//
// Convenção: pontos são [lat, lng]; GeoJSON é [lng, lat].

export type Ponto = [number, number];

const R_TERRA_M = 6371000;
const RAD = Math.PI / 180;

export function distanciaHaversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return R_TERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Anel = Array<[number, number]>; // [lng, lat]

/** Anéis externos de Polygon/MultiPolygon (aceita Feature ou geometria). Buracos são ignorados. */
export function aneisExternos(geojson: any): Anel[] {
  const geom = geojson?.geometry || geojson;
  if (!geom?.coordinates) return [];
  const limpa = (r: any): Anel =>
    Array.isArray(r)
      ? (r.filter((p: any) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number") as Anel)
      : [];
  if (geom.type === "Polygon") return [limpa(geom.coordinates[0])].filter((r) => r.length >= 3);
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.map((poly: any) => limpa(poly?.[0])).filter((r: Anel) => r.length >= 3);
  }
  return [];
}

function pontoNoAnel(lng: number, lat: number, anel: Anel): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function pontoNosAneis(lng: number, lat: number, aneis: Anel[]): boolean {
  return aneis.some((a) => pontoNoAnel(lng, lat, a));
}

/** Centro aproximado (média dos vértices do primeiro anel) — só para referência. */
function centroDosAneis(aneis: Anel[]): { lat: number; lng: number } | null {
  const a = aneis[0];
  if (!a?.length) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of a) {
    sx += x;
    sy += y;
  }
  return { lng: sx / a.length, lat: sy / a.length };
}

/**
 * Pontos de amostra DENTRO do polígono, em grade regular (ordem linha a linha).
 * Retorna até `max` pontos [lat, lng]. Se o imóvel for minúsculo, devolve ao menos 1 ponto interno.
 */
export function amostrarInterior(geojson: any, max = 100): Ponto[] {
  const aneis = aneisExternos(geojson);
  if (aneis.length === 0 || max < 1) return [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const a of aneis) {
    for (const [x, y] of a) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!isFinite(minX) || !isFinite(minY)) return [];

  let k = Math.max(3, Math.ceil(Math.sqrt(max * 1.6)));
  let dentro: Ponto[] = [];
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    dentro = [];
    for (let iy = 0; iy < k; iy++) {
      const lat = minY + ((iy + 0.5) / k) * (maxY - minY);
      for (let ix = 0; ix < k; ix++) {
        const lng = minX + ((ix + 0.5) / k) * (maxX - minX);
        if (pontoNosAneis(lng, lat, aneis)) dentro.push([lat, lng]);
      }
    }
    if (dentro.length >= Math.min(max, 8) || k >= 90) break;
    k = Math.ceil(k * 1.6); // polígono fino/irregular: refina a grade
  }

  if (dentro.length === 0) {
    const c = centroDosAneis(aneis);
    if (c && pontoNosAneis(c.lng, c.lat, aneis)) return [[c.lat, c.lng]];
    const [x, y] = aneis[0][0];
    return [[y, x]];
  }
  if (dentro.length <= max) return dentro;
  const passo = dentro.length / max;
  const saida: Ponto[] = [];
  for (let i = 0; i < max; i++) saida.push(dentro[Math.floor(i * passo)]);
  return saida;
}

// ---------- distância borda do imóvel -> feições ----------

type Seg = [number, number, number, number]; // x1,y1,x2,y2 (metros)

function distPontoSegmento(px: number, py: number, s: Seg): number {
  const [x1, y1, x2, y2] = s;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentosSeCruzam(a: Seg, b: Seg): boolean {
  const [ax, ay, bx, by] = a;
  const [cx, cy, dx, dy] = b;
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function distSegmentoSegmento(a: Seg, b: Seg): number {
  if (segmentosSeCruzam(a, b)) return 0;
  return Math.min(
    distPontoSegmento(a[0], a[1], b),
    distPontoSegmento(a[2], a[3], b),
    distPontoSegmento(b[0], b[1], a),
    distPontoSegmento(b[2], b[3], a),
  );
}

interface Parte {
  coords: Array<[number, number]>; // [lng, lat]
  fechada: boolean; // anel de área (lago/represa)
}

function partesDaFeicao(geom: any): Parte[] {
  if (!geom?.coordinates) return [];
  const ok = (p: any) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number";
  const linha = (c: any): Array<[number, number]> => (Array.isArray(c) ? c.filter(ok) : []);
  switch (geom.type) {
    case "Point":
      return ok(geom.coordinates) ? [{ coords: [geom.coordinates], fechada: false }] : [];
    case "MultiPoint":
      return linha(geom.coordinates).map((p) => ({ coords: [p], fechada: false }));
    case "LineString":
      return [{ coords: linha(geom.coordinates), fechada: false }];
    case "MultiLineString":
      return geom.coordinates.map((l: any) => ({ coords: linha(l), fechada: false }));
    case "Polygon":
      return [{ coords: linha(geom.coordinates[0]), fechada: true }];
    case "MultiPolygon":
      return geom.coordinates.map((p: any) => ({ coords: linha(p?.[0]), fechada: true }));
    default:
      return [];
  }
}

/**
 * Menor distância (m) entre o IMÓVEL (polígono) e as feições. 0 quando a feição toca, cruza ou
 * está dentro do imóvel (ex.: córrego que atravessa a fazenda). null quando não há feição válida.
 */
export function distanciaAtePoligonoM(geojson: any, colecao: any): number | null {
  const aneis = aneisExternos(geojson);
  const feicoes: any[] = colecao?.features || [];
  if (aneis.length === 0 || feicoes.length === 0) return null;

  const ref = centroDosAneis(aneis)!;
  const cosLat = Math.cos(ref.lat * RAD);
  const proj = (lng: number, lat: number): [number, number] => [
    R_TERRA_M * (lng - ref.lng) * RAD * cosLat,
    R_TERRA_M * (lat - ref.lat) * RAD,
  ];

  const segsImovel: Seg[] = [];
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const anel of aneis) {
    const pts = anel.map(([lng, lat]) => proj(lng, lat));
    for (const [x, y] of pts) {
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      segsImovel.push([p[0], p[1], q[0], q[1]]);
    }
  }

  let melhor = Infinity;
  let viuAlgo = false;

  for (const f of feicoes) {
    for (const parte of partesDaFeicao(f?.geometry)) {
      if (parte.coords.length === 0) continue;
      viuAlgo = true;
      const pts = parte.coords.map(([lng, lat]) => proj(lng, lat));

      // limite inferior pela caixa envolvente: descarta feições claramente mais longe que a melhor
      let px0 = Infinity;
      let py0 = Infinity;
      let px1 = -Infinity;
      let py1 = -Infinity;
      for (const [x, y] of pts) {
        if (x < px0) px0 = x;
        if (x > px1) px1 = x;
        if (y < py0) py0 = y;
        if (y > py1) py1 = y;
      }
      const gapX = Math.max(0, px0 - bx1, bx0 - px1);
      const gapY = Math.max(0, py0 - by1, by0 - py1);
      if (Math.hypot(gapX, gapY) >= melhor) continue;

      // vértice da feição dentro do imóvel => 0
      let dentro = false;
      for (let i = 0; i < parte.coords.length; i++) {
        if (pontoNosAneis(parte.coords[i][0], parte.coords[i][1], aneis)) {
          dentro = true;
          break;
        }
      }
      if (dentro) return 0;

      // imóvel dentro de um lago/represa => 0
      if (parte.fechada && parte.coords.length >= 3) {
        const anelFeicao = parte.coords as Anel;
        if (aneis.some((a) => a.length > 0 && pontoNoAnel(a[0][0], a[0][1], anelFeicao))) return 0;
      }

      if (pts.length === 1) {
        for (const s of segsImovel) {
          const d = distPontoSegmento(pts[0][0], pts[0][1], s);
          if (d < melhor) melhor = d;
        }
        continue;
      }

      const total = parte.fechada ? pts.length : pts.length - 1;
      for (let i = 0; i < total; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % pts.length];
        const sf: Seg = [p[0], p[1], q[0], q[1]];
        for (const si of segsImovel) {
          const d = distSegmentoSegmento(sf, si);
          if (d === 0) return 0;
          if (d < melhor) melhor = d;
        }
      }
    }
  }

  if (!viuAlgo || !isFinite(melhor)) return null;
  return Math.round(melhor);
}
