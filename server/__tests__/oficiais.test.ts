import assert from "node:assert/strict";
import { criarDbTeste, criarHubFalso } from "./helpers";
import { atualizarDadosOficiais } from "../lib/dados-oficiais";
import { gravarManual } from "../lib/atributos-db";
import { atributoParaPublico, type AtributoRow } from "../lib/publico";
import { limparCacheControle, type FontesMalha } from "../lib/ibge-malha";

const poligono = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-46.60, -18.70], [-46.58, -18.70], [-46.58, -18.68], [-46.60, -18.68], [-46.60, -18.70]]] } };
const linhaPerto = { type: "Feature", properties: { sigla: "BR-365", jurisdicao: "Federal", revestimento: "Pavimentado", nome: "Ferrovia X" }, geometry: { type: "LineString", coordinates: [[-46.57, -18.71], [-46.57, -18.67]] } };

const fontesCom = (features: any[]): FontesMalha => ({
  wfs: async () => ({ ok: true, features, truncado: false }),
  extensao: async () => ({ minLon: -75, minLat: -35, maxLon: -30, maxLat: 6 }),
});
const lerLinha = async (db: any, id: number, chave: string) => (await db.query("SELECT * FROM fazenda_atributos WHERE fazenda_id=$1 AND chave=$2", [id, chave])).rows[0];

export async function rodar() {
  const db = await criarDbTeste();
  const id = (await db.query("INSERT INTO fazendas (slug, titulo) VALUES ('teste-oficiais','Teste') RETURNING id")).rows[0].id as number;
  const hub = criarHubFalso();
  hub.ti = { ok: true, data: { sobrepoe: true, itens: [{ nome: "TI Exemplo", detalhe: "Etnia · 12% do imóvel" }] } };

  // ---- gravação: origem oficial, nada público, rodovia lida, TI detectada ----
  const r1 = await atualizarDadosOficiais(db, hub, id, poligono, { fontesMalha: fontesCom([linhaPerto]) });
  assert.equal(r1.sobrep_terra_indigena, "gravado");
  const rod = await lerLinha(db, id, "logistica_rodovia");
  assert.equal(rod.origem, "oficial"); assert.equal(rod.achado, "detectado"); assert.equal(rod.publico, false);
  assert.ok(rod.valor_json > 0 && rod.valor_json < 3000, `distância plausível, veio ${rod.valor_json}`);
  const ti = await lerLinha(db, id, "sobrep_terra_indigena");
  assert.equal(ti.achado, "detectado"); assert.match(ti.valor_json, /TI Exemplo/);
  const uc = await lerLinha(db, id, "sobrep_unidade_conservacao");
  assert.equal(uc.achado, "nao_detectado"); assert.equal(uc.estado, "indicado");

  // ---- público: positivo vira texto genérico (sem nome); "não detectado" automático nunca aparece ----
  const pub = (l: any): AtributoRow => ({ ...l, publico: true });
  assert.equal(atributoParaPublico(pub(ti)), null);   // sobreposição encontrada nunca vai ao site
  const alt = atributoParaPublico(pub(await lerLinha(db, id, "logistica_rodovia")))!;
  assert.equal(alt.origem, "oficial"); assert.match(alt.fonte!, /IBGE/); assert.match(alt.atualizado_em!, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(alt).sort(), ["atualizado_em", "chave", "confianca", "fonte", "origem", "rotulo", "texto"]); // sem observação, valor bruto nem dados do dono
  assert.equal(atributoParaPublico(pub(uc)), null);
  // confirmado por documento: aí sim "Sem sobreposição"
  await gravarManual(db, id, "sobrep_unidade_conservacao", { achado: "nao_detectado", confirmado_por: "documento", publico: true });
  const uc2 = await lerLinha(db, id, "sobrep_unidade_conservacao");
  assert.equal(uc2.origem, "corretor");
  assert.equal(atributoParaPublico(uc2)!.texto, "Sem sobreposição");
  assert.equal(atributoParaPublico(uc2)!.fonte, undefined);   // origem corretor: sem selo de fonte oficial

  // ---- falha não vira "não detectado" nem apaga leitura boa ----
  hub.ti = { ok: false, motivo: "Hub API indisponível" };
  const offline: FontesMalha = { wfs: async () => ({ ok: false, features: [], truncado: false }), extensao: async () => null };
  const r2 = await atualizarDadosOficiais(db, hub, id, poligono, { fontesMalha: offline });
  assert.equal(r2.sobrep_terra_indigena, "mantido"); assert.equal(r2.logistica_rodovia, "mantido");
  assert.equal((await lerLinha(db, id, "logistica_rodovia")).achado, "detectado");
  assert.equal((await lerLinha(db, id, "sobrep_terra_indigena")).achado, "detectado");
  assert.equal((await lerLinha(db, id, "sobrep_unidade_conservacao")).estado, "confirmado"); // confirmação humana intacta

  // ---- sem leitura anterior, falha vira "sem dado" (nunca ausência) ----
  const id2 = (await db.query("INSERT INTO fazendas (slug, titulo) VALUES ('teste-oficiais-2','Teste 2') RETURNING id")).rows[0].id as number;
  await atualizarDadosOficiais(db, hub, id2, poligono, { fontesMalha: offline });
  for (const k of ["sobrep_terra_indigena", "logistica_rodovia", "logistica_ferrovia"]) {
    const l = await lerLinha(db, id2, k); assert.equal(l.estado, "sem_dado", k); assert.equal(l.achado, "indeterminado", k);
  }

  // ---- camada que responde vazio no controle positivo não prova ausência ----
  limparCacheControle();
  const vazia = await atualizarDadosOficiais(db, hub, id2, poligono, { fontesMalha: fontesCom([]) });
  assert.ok(vazia.logistica_rodovia);
  assert.equal((await lerLinha(db, id2, "logistica_rodovia")).achado, "indeterminado");
}
