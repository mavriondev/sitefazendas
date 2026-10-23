import assert from "node:assert/strict";
import { paginarFotos } from "../../client/src/lib/ficha";

export async function rodar() {
  for (const quantidade of [0, 1, 2, 3, 4, 5, 8, 13]) {
    const fotos = Object.freeze(Array.from({ length: quantidade }, (_, i) => ({
      url: `/uploads/foto-${i}.jpg`,
      legenda: i % 2 ? null : `Foto ${i}`,
    })));
    const paginas = paginarFotos(fotos);
    assert.equal(paginas.length, Math.ceil(quantidade / 2));
    assert.deepEqual(paginas.flat(), fotos, "Nenhuma foto pode desaparecer ou mudar de ordem");
    assert(paginas.every((p) => p.length >= 1 && p.length <= 2));
    assert(paginas.slice(0, -1).every((p) => p.length === 2));
    if (quantidade > 0) assert.equal(paginas.at(-1)!.length, quantidade % 2 || 2);
  }
}
