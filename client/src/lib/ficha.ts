/** Mantém todas as fotos públicas, na ordem editorial, com duas por página. */
export function paginarFotos<T>(fotos: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(fotos.length / 2) }, (_, pagina) =>
    fotos.slice(pagina * 2, pagina * 2 + 2),
  );
}
