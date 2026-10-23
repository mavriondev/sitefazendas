import assert from "node:assert/strict";
import { apagarCookiesRastreio } from "../../client/src/lib/rastreamento";

export async function rodar() {
  const anteriores = ["document", "location"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  try {
    Object.defineProperty(globalThis, "location", { configurable: true, value: { hostname: "fazendas.example" } });
    const doc = {};
    Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
    Object.defineProperty(doc, "cookie", { configurable: true, get() { throw new Error("SecurityError"); } });
    assert.doesNotThrow(() => apagarCookiesRastreio(true, true), "Recusa funciona com leitura bloqueada");
    Object.defineProperty(doc, "cookie", {
      configurable: true, get() { return "_ga=teste; _fbp=teste; sessao=preservar"; },
      set() { throw new Error("SecurityError"); },
    });
    assert.doesNotThrow(() => apagarCookiesRastreio(true, true), "Recusa funciona com exclusão bloqueada");
    const apagados: string[] = [];
    Object.defineProperty(doc, "cookie", {
      configurable: true, get() { return "_ga=teste; _fbp=teste; sessao=preservar"; },
      set(v: string) { apagados.push(v.split("=")[0]); },
    });
    apagarCookiesRastreio(true, false);
    assert.deepEqual([...new Set(apagados)], ["_ga"]);
    apagados.length = 0;
    apagarCookiesRastreio(false, true);
    assert.deepEqual([...new Set(apagados)], ["_fbp"]);
  } finally {
    for (const [k, descriptor] of anteriores) {
      if (descriptor) Object.defineProperty(globalThis, k, descriptor);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
}
