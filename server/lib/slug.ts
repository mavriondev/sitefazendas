import { semAcento } from "./sigilo";

/** Slug público. Não usa município nem CAR: parte do título (que passa pela guarda de sigilo) + sufixo aleatório. */
export function gerarSlug(titulo: string, aleatorio: () => string = () => Math.random().toString(36).slice(2, 7)): string {
  const base = semAcento(titulo).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "fazenda";
  return `${base}-${aleatorio()}`;
}
