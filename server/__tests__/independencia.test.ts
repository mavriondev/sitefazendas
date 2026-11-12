import assert from "node:assert/strict";
import { subirApp, jpegComExif } from "./helpers";
import { gravarAutomatico } from "../lib/atributos-db";

/** Usa apenas banco, uploads e identidades sintéticos; qualquer rede externa falha. */
export async function rodar() {
  const original = globalThis.fetch;
  let externas = 0;
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
    if (url.hostname !== "127.0.0.1") {
      externas++;
      throw new Error("Consulta externa proibida neste teste");
    }
    return original(input, init);
  }) as typeof fetch;
  const t = await subirApp();
  try {
    const { admin, db } = t, anon = t.cliente();
    const id = (await admin.post("/api/admin/fazendas", {
      titulo: "Fazenda de teste independente", descricao_publica: "Imóvel rural para venda.",
      regiao_publica: "Centro-Oeste", car_codigo: "MT-0000000-TESTE", area_ha: 1500,
    })).json.id;
    // Conserva um registro histórico e sua procedência, sem consultar a fonte.
    await gravarAutomatico(db, id, "altitude_media", {
      achado: "detectado", valor: 720, fonte: "Fonte histórica sintética",
    });
    const antes = (await admin.get(`/api/admin/fazendas/${id}`)).json;
    await db.query("INSERT INTO configuracoes (chave,valor) VALUES ('modulo_pesquisa_ativo','true'::jsonb)");
    for (const rota of [`/api/admin/fazendas/${id}/enriquecer`, `/api/admin/fazendas/${id}/texto-ia`, "/api/pesquisa/buscar", "/api/pesquisa/interesse"]) {
      assert.equal((await admin.post(rota, { uf: "MT", area_min: 100 })).status, 404, rota);
    }
    assert.equal((await anon.get("/api/pesquisa/status")).status, 404);
    assert.equal((await anon.get("/pesquisa")).status, 404);
    assert.deepEqual((await admin.get(`/api/admin/fazendas/${id}`)).json, antes);
    assert.equal((await admin.put("/api/admin/config", { modulo_pesquisa_ativo: true })).status, 400);
    assert.equal((await anon.get("/api/public/config")).json.modulo_pesquisa_ativo, undefined);
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/altitude_media`, {
      achado: "detectado", valor: 750, confirmado_por: "documento", publico: true,
    })).status, 200);
    const alt = (await admin.get(`/api/admin/fazendas/${id}`)).json.atributos.find((a: any) => a.chave === "altitude_media");
    assert.equal(alt.origem, "corretor");
    assert.equal(alt.valor_json, 750);
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/estado_publico`, {
      achado: "detectado", valor: "MT", confirmado_por: "documento", publico: true,
    })).status, 200);
    assert.equal((await admin.upload(`/api/admin/fazendas/${id}/fotos`, jpegComExif())).status, 201);
    assert.equal((await admin.post(`/api/admin/fazendas/${id}/status`, { status: "publicada" })).status, 200);
    const lista = (await anon.get("/api/public/fazendas?uf=MT")).json;
    assert.equal(lista.total, 1);
    assert.ok(!JSON.stringify(lista).includes("MT-0000000-TESTE"));
    assert.equal(externas, 0, "cadastro, edição, publicação e filtros não consultam outros sistemas");
  } finally {
    await t.fechar();
    globalThis.fetch = original;
  }
}
