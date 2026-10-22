// Mapa de REGIÃO aproximada (opcional por fazenda). Nunca devolve a posição real:
// o centro do círculo é deslocado de 2 a 5 km em direção fixa e aleatória (guardada no banco, não muda a cada visita,
// o que impede "tirar a média" de várias consultas), e o raio é de 12 km. A fazenda fica dentro do círculo,
// mas a área coberta (~450 km²) é grande demais para identificar a propriedade.

export const RAIO_REGIAO_KM = 12;

export function regiaoAproximada(lat: number | null, lon: number | null, ang: number, dist: number): { lat: number; lon: number; raio_km: number } | null {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const a = Math.min(Math.max(ang, 0), 1) * 2 * Math.PI;
  const km = 2 + Math.min(Math.max(dist, 0), 1) * 3;
  // Keep both rounded coordinates displaced from the source point, even when
  // the stored random angle is nearly due north/south or east/west.
  const minComponent = 0.72;
  const x = Math.sign(Math.cos(a) || 1) * Math.max(Math.abs(Math.cos(a)), minComponent);
  const y = Math.sign(Math.sin(a) || 1) * Math.max(Math.abs(Math.sin(a)), minComponent);
  const norm = Math.hypot(x, y);
  const dLat = (km * x / norm) / 111.32;
  const dLon = (km * y / norm) / (111.32 * Math.cos((lat * Math.PI) / 180));
  const r = (n: number) => Math.round(n * 100) / 100; // 2 casas (~1 km): sem falsa precisão
  return { lat: r(lat + dLat), lon: r(lon + dLon), raio_km: RAIO_REGIAO_KM };
}
