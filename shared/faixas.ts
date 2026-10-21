// Faixas públicas: a vitrine nunca mostra o número exato de atributos geográficos.

const fmt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Faixa de largura `passo` que contém `valor` (ex.: 847, 100 → [800, 900]). */
export function limitesDaFaixa(valor: number, passo: number): [number, number] {
  const ini = Math.floor(valor / passo) * passo;
  return [ini, ini + passo];
}

export function faixaNumero(valor: number, passo: number, unidade?: string): string {
  const [a, b] = limitesDaFaixa(valor, passo);
  const u = unidade ? (unidade === "%" ? "%" : ` ${unidade}`) : "";
  return `${fmt(a)} a ${fmt(b)}${u}`;
}

/** Classes de relevo (Embrapa) a partir da declividade média em %. */
export function classeRelevo(declividadePct: number): string {
  if (declividadePct < 3) return "plano";
  if (declividadePct < 8) return "suave ondulado";
  if (declividadePct < 20) return "ondulado";
  if (declividadePct < 45) return "forte ondulado";
  return "montanhoso";
}

export function faixaDistanciaKm(metros: number): string {
  const km = metros / 1000;
  if (km <= 5) return "até 5 km";
  if (km <= 15) return "de 5 a 15 km";
  if (km <= 30) return "de 15 a 30 km";
  return "acima de 30 km";
}

export function faixaArea(ha: number): string {
  if (ha < 100) return "até 100 ha";
  if (ha < 500) return "100 a 500 ha";
  if (ha < 1000) return "500 a 1.000 ha";
  if (ha < 2500) return "1.000 a 2.500 ha";
  if (ha < 5000) return "2.500 a 5.000 ha";
  if (ha < 10000) return "5.000 a 10.000 ha";
  return "acima de 10.000 ha";
}
