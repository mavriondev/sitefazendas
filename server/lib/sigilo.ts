// Guarda de sigilo: texto que vai para a vitrine não pode revelar onde a fazenda fica.

export interface DadosPrivados {
  municipio?: string | null;
  uf?: string | null;
  car_codigo?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizar(s: string): string {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const RE_CAR = /\b[A-Za-z]{2}-\d{7}-[A-Fa-f0-9]{32}\b/;
const RE_CAR_PARCIAL = /\b[A-Za-z]{2}-\d{7}-[A-Fa-f0-9]{8,}\b/;
// par de coordenadas decimais (ex.: -16.9234, -43.1234) ou graus/minutos
const RE_COORD = /-?\d{1,3}[.,]\d{3,}\s*[,;/ ]\s*-?\d{1,3}[.,]\d{3,}/;
const RE_GMS = /\d{1,3}\s*[°º]\s*\d{1,2}\s*['′]/;
const RE_LINK_MAPA = /(google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl|waze\.com|openstreetmap\.org|earth\.google)/i;

/** Devolve a lista de motivos pelos quais o texto não pode ir para a vitrine (vazia = ok). */
export function vazaDadoSensivel(texto: string | null | undefined, privado: DadosPrivados): string[] {
  const motivos: string[] = [];
  if (!texto) return motivos;
  const n = ` ${normalizar(texto)} `;

  const mun = privado.municipio ? normalizar(privado.municipio) : "";
  if (mun.length >= 3 && n.includes(` ${mun} `)) motivos.push(`cita o município (${privado.municipio})`);

  if (privado.car_codigo) {
    const car = privado.car_codigo.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (car.length >= 8 && texto.replace(/[^A-Za-z0-9]/g, "").toLowerCase().includes(car)) motivos.push("cita o código do CAR");
  }
  if (RE_CAR.test(texto) || RE_CAR_PARCIAL.test(texto)) motivos.push("contém um código de CAR");
  if (RE_COORD.test(texto) || RE_GMS.test(texto)) motivos.push("contém coordenadas");
  if (RE_LINK_MAPA.test(texto)) motivos.push("contém link de mapa");

  // "Botumirim/MG", "Botumirim - MG" já caem no teste do município; aqui pega município + UF genérico
  if (privado.latitude != null && privado.longitude != null) {
    const lat = Math.abs(privado.latitude).toFixed(2);
    const lon = Math.abs(privado.longitude).toFixed(2);
    if (texto.includes(lat) && texto.includes(lon)) motivos.push("contém coordenadas da fazenda");
  }
  return motivos;
}
