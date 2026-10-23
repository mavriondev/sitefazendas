import assert from "node:assert/strict";
import fs from "node:fs";
import { subirApp, jpegComExif } from "./helpers";
import { linkWhatsapp } from "../../client/src/api";
import { normalizarImovelHub } from "../lib/hub";

export async function rodar() {
  for (const n of ["(55) 99999-1234", "+55 55 99999-1234"]) assert.equal(new URL(linkWhatsapp(n, "Teste")!).pathname, "/5555999991234");
  assert.equal(new URL(linkWhatsapp("(11) 3333-1234", "Teste")!).pathname, "/551133331234");
  for (const n of ["", "123", "1234567890123456", "+44 123456789012"]) assert.equal(linkWhatsapp(n, ""), null);
  const empty = normalizarImovelHub({ num_area: "", alt_media: " ", argila_media: "" });
  assert.equal(empty.area_ha, null); assert.equal(empty.alt_media, null); assert.equal(empty.argila_media, null);
  const t = await subirApp();
  const { admin, db } = t, anon = t.cliente();
  try {
    const id = (await admin.post("/api/admin/fazendas", { titulo: "Fazenda em Botumirim", municipio: "Botumirim" })).json.id;
    assert.equal((await admin.put(`/api/admin/fazendas/${id}`, { titulo: "Fazenda de teste", descricao_publica: "Terra produtiva.", regiao_publica: "Norte de Minas Gerais", area_ha: 1500, car_codigo: "MG-3108107-AAAA" })).status, 200);
    const before = (await admin.get(`/api/admin/fazendas/${id}`)).json;
    assert.ok(!before.fazenda.slug.includes("botumirim"), "endereço do rascunho saneado após corrigir título");
    assert.equal((await admin.upload(`/api/admin/fazendas/${id}/fotos`, jpegComExif(), "segura.jpg")).status, 201);
    assert.equal((await admin.post(`/api/admin/fazendas/${id}/status`, { status: "publicada" })).status, 200);
    const files = fs.readdirSync(t.uploadsDir).sort();
    for (const legenda of ["Vista em Botumirim", "CAR MG-3108107-AAAA", "-16.9234, -43.1234"]) {
      assert.equal((await admin.upload(`/api/admin/fazendas/${id}/fotos`, jpegComExif(), "privada.jpg", "image/jpeg", { legenda })).status, 409);
      assert.deepEqual(fs.readdirSync(t.uploadsDir).sort(), files, "foto recusada não deixa arquivo no disco");
    }
    assert.equal((await admin.upload(`/api/admin/fazendas/${id}/fotos`, jpegComExif(), "nova.jpg", "image/jpeg", { legenda: "Lavoura" })).status, 201);
    const filesBeforeFailure = fs.readdirSync(t.uploadsDir).sort();
    const realQuery = db.query.bind(db);
    db.query = async (sql, args) => {
      if (/^\s*INSERT INTO fazenda_fotos/i.test(sql)) throw new Error("falha simulada de INSERT");
      return realQuery(sql, args);
    };
    assert.equal((await admin.upload(`/api/admin/fazendas/${id}/fotos`, jpegComExif(), "falha.jpg")).status, 500);
    db.query = realQuery;
    assert.deepEqual(fs.readdirSync(t.uploadsDir).sort(), filesBeforeFailure, "falha no banco remove arquivo órfão");

    const body = { achado: "detectado", valor: "Galpão em Botumirim", publico: true };
    // Conta tentativas de escrita: rejeição deve ocorrer ANTES de qualquer INSERT/UPDATE.
    const query = db.query.bind(db); let writes = 0;
    db.query = async (sql, args) => { if (/^\s*(INSERT|UPDATE).*fazenda_atributos/is.test(sql)) writes++; return query(sql, args); };
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/benfeitorias`, body)).status, 409);
    assert.equal(writes, 0);
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/benfeitorias`, { ...body, publico: false })).status, 200);
    writes = 0;
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/benfeitorias/publico`, { publico: true })).status, 409);
    assert.equal(writes, 0);
    assert.equal((await admin.get(`/api/admin/fazendas/${id}`)).json.atributos.find((a: any) => a.chave === "benfeitorias").publico, false);
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/benfeitorias`, { achado: "detectado", valor: "Galpão", publico: true })).status, 200);
    for (const extra of [{ fonte: {} }, { observacao: [] }, { publico: "true" }]) {
      assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/benfeitorias`, { ...body, ...extra })).status, 400);
    }
    db.query = query;
    const draft = (await admin.post("/api/admin/fazendas", { titulo: "Rascunho", municipio: "Botumirim" })).json.id;
    assert.equal((await admin.post("/api/admin/slides", { titulo: "Vista em Botumirim", link_tipo: "fazenda", fazenda_id: id })).status, 400);
    const slide = (await admin.post("/api/admin/slides", { titulo: "Seleção", link_tipo: "fazenda", fazenda_id: id })).json.id;
    const hidden = (await admin.post("/api/admin/slides", { titulo: "Em preparação", link_tipo: "fazenda", fazenda_id: draft })).json.id;
    const image = await admin.upload(`/api/admin/slides/${hidden}/imagem`, jpegComExif());
    assert.equal(image.status, 200);
    let home = (await anon.get("/api/public/home")).json;
    assert.ok(home.slides.some((s: any) => s.id === slide));
    assert.ok(!home.slides.some((s: any) => s.id === hidden));
    const filename = (await admin.get("/api/admin/slides")).json.slides.find((s: any) => s.id === hidden).arquivo;
    assert.equal((await anon.get(`/uploads/${filename}`)).status, 404);
    // Registros legados/concor­rência: defesa na leitura impede texto privado mesmo fora das rotas.
    await db.query("UPDATE fazenda_atributos SET valor_json=$2::jsonb WHERE fazenda_id=$1 AND chave='benfeitorias'", [id, JSON.stringify("Galpão em Botumirim")]);
    await db.query("UPDATE fazenda_fotos SET legenda='Vista em Botumirim' WHERE fazenda_id=$1", [id]);
    const detail = await anon.get(`/api/public/fazendas/${before.fazenda.slug}`);
    assert.ok(!detail.texto.includes("Botumirim"));
    await db.query("UPDATE slides SET titulo='Vista em Botumirim' WHERE id=$1", [slide]);
    assert.ok(!(await anon.get("/api/public/home")).json.slides.some((s: any) => s.id === slide));
    await admin.post(`/api/admin/fazendas/${id}/status`, { status: "arquivada" });
    home = (await anon.get("/api/public/home")).json;
    assert.ok(!home.slides.some((s: any) => s.id === slide));
  } finally { await t.fechar(); }
}
