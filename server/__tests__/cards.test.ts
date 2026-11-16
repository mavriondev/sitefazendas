import assert from "node:assert/strict";
import { subirApp } from "./helpers";
import { migrar } from "../schema";
import { validarCards, resolverCards, LIMITE_CARDS, type CardFazenda } from "../../shared/cards";
import { cardsParaPublico, problemasSigiloCard } from "../lib/cards";

const editorial = (id = "proprio", extra = {}): CardFazenda => ({
  id, tipo: "editorial", titulo: "Estrutura", informacao: "Informação autorizada para divulgação",
  complemento: "Descrição complementar revisada", icone: "estrutura", visivel: true, ...extra,
});
const vinculado = (origem = "atributo:agua", id = "vinculo"): CardFazenda => ({
  id, tipo: "vinculado", origem, titulo: "Dado público", complemento: "", icone: "agua", visivel: true,
});

export async function rodar() {
  assert.deepEqual(validarCards([]).cards, []);
  for (const entrada of [null, {}, Array.from({ length: LIMITE_CARDS + 1 }, (_, i) => editorial(`c${i}`)),
    [editorial(), editorial()], [editorial("x", { titulo: " " })], [editorial("x", { informacao: "" })],
    [editorial("x", { titulo: "x".repeat(81) })], [editorial("x", { informacao: "x".repeat(321) })],
    [editorial("x", { complemento: "x".repeat(241) })], [editorial("x", { icone: "<svg>" })],
    [editorial("x", { icone: { toString: null } })],
    [editorial("x", { visivel: "sim" })], [editorial("x", { informacao: "<script>alert(1)</script>" })],
    [editorial("x", { complemento: "\u0000" })], [editorial("x", { fazenda_id: 2 })],
    [vinculado("car_codigo")], [vinculado("atributo:ndvi")], [vinculado("atributo:area_total_ha")]]) {
    assert.ok(validarCards(entrada).erro, JSON.stringify(entrada));
  }
  for (const informacao of ["1.454 ha", "Área de 1454", "1454 hectares", "28 alqueires", "140 m²", "1,5 km2"]) {
    assert.ok(problemasSigiloCard(editorial("area", { informacao }), {}).length, informacao);
  }
  for (const informacao of ["1454,4", "1.454,4", "1454.4"]) {
    assert.ok(problemasSigiloCard(editorial("area", { informacao }), { area_ha: 1454.4 }).length, informacao);
  }
  const base = { area: null, regiao: "Região ampla", culturas: [], atributos: [] };
  assert.deepEqual(resolverCards(null, base).map(c => c.id), ["inicial-regiao"]);
  assert.deepEqual(resolverCards([], base), []);
  assert.deepEqual(cardsParaPublico([editorial()], base, { municipio: "Estrutura" }), []);
  const t = await subirApp();
  try {
    const { admin, cliente, db } = t;
    const id = (await admin.post("/api/admin/fazendas", { titulo: "Teste isolado de cards", regiao_publica: "Região ampla", municipio: "MunicipioReservado", area_ha: 1454 })).json.id;
    const outroId = (await admin.post("/api/admin/fazendas", { titulo: "Outro cadastro isolado" })).json.id;
    const path = `/api/admin/fazendas/${id}/cards`;
    const detalhe = async () => (await admin.get(`/api/admin/fazendas/${id}`)).json;
    const slug = (await detalhe()).fazenda.slug;
    const publico = async () => (await cliente().get(`/api/public/fazendas/${slug}`)).json;
    assert.equal((await cliente().put(path, { cards: [] })).status, 401);
    const comprador = cliente();
    assert.equal((await comprador.post("/api/auth/registrar", { nome: "Comprador Teste", email: "cards@example.test", senha: "senha-forte-2", whatsapp: "11987654321", aceite: true })).status, 201);
    assert.equal((await comprador.put(path, { cards: [] })).status, 403);
    assert.equal((await admin.put("/api/admin/fazendas/999999/cards", { cards: [] })).status, 404);
    assert.equal((await admin.put("/api/admin/fazendas/abc/cards", { cards: [] })).status, 400);
    assert.equal((await admin.put(path, { cards: [], extra: true })).status, 400);
    assert.equal((await admin.put(path, {})).status, 400);
    assert.equal((await admin.put(path, { cards: [editorial("x", { titulo: "" })] })).status, 400);
    assert.equal((await detalhe()).fazenda.cards, null);
    assert.deepEqual((await detalhe()).cards_configuracao.map((c: CardFazenda) => c.id), ["inicial-regiao"]);
    // Não há cards de anúncios não publicados, nem acesso por ID público.
    assert.equal((await cliente().get(`/api/public/fazendas/${slug}`)).status, 404);
    const attrs = async (chave: string, valor: unknown, publico = true, origem = "corretor") => {
      await db.query(`INSERT INTO fazenda_atributos (fazenda_id,chave,estado,achado,valor_json,publico,origem)
        VALUES ($1,$2,'indicado','detectado',$3::jsonb,$4,$5)
        ON CONFLICT (fazenda_id,chave) DO UPDATE SET valor_json=$3::jsonb,publico=$4,origem=$5`,
      [id, chave, JSON.stringify(valor), publico, origem]);
    };
    await attrs("agua", "Descrição de água revisada");
    await attrs("area_total_ha", 1454);
    await attrs("altitude_media", 812, true, "oficial");
    await db.query("UPDATE fazendas SET status='publicada' WHERE id=$1", [id]);
    assert.deepEqual((await publico()).cards.map((c: any) => c.id), ["inicial-area", "inicial-regiao", "inicial-agua"]);
    const itens = [editorial(), vinculado(), vinculado("area", "area"), vinculado("atributo:altitude_media", "altitude"), editorial("oculto", { visivel: false, informacao: "Rascunho reservado" })];
    assert.equal((await admin.put(path, { cards: itens })).status, 200);
    assert.deepEqual((await detalhe()).cards_configuracao, itens);
    let p = await publico();
    assert.equal(p.cards.length, 4);
    assert.equal(p.cards[1].informacao, "Descrição de água revisada");
    assert.equal(p.cards[2].informacao, "1.000 a 2.500 ha");
    assert.equal(p.cards[3].informacao, "800 a 900 m");
    assert.equal(p.cards[3].atributo.origem, "oficial");
    assert.match(p.cards[3].atributo.fonte, /NASA/);
    assert.ok(p.atributos.some((a: any) => a.chave === "agua"));
    assert.ok(!JSON.stringify(p).includes("Rascunho reservado"));
    assert.ok(!("tipo" in p.cards[0]) && !("visivel" in p.cards[0]));
    // Nenhuma configuração editorial migra para a busca/home.
    assert.ok(!(await cliente().get("/api/public/fazendas")).json.fazendas.some((f: any) => "cards" in f));
    const ordem = [...itens].reverse();
    assert.equal((await admin.put(path, { cards: ordem })).status, 200);
    assert.deepEqual((await detalhe()).cards_configuracao.map((c: any) => c.id), ordem.map(c => c.id));
    assert.deepEqual((await publico()).cards.map((c: any) => c.id), ["altitude", "area", "vinculo", "proprio"]);
    await attrs("agua", "Texto novo da origem");
    assert.equal((await publico()).cards.find((c: any) => c.id === "vinculo").informacao, "Texto novo da origem");
    await attrs("agua", "Texto agora privado", false);
    await attrs("area_total_ha", 1454, false);
    p = await publico();
    assert.ok(!p.cards.some((c: any) => ["vinculo", "area"].includes(c.id)));
    assert.ok(!JSON.stringify(p).includes("Texto agora privado"));
    assert.ok(!JSON.stringify(p.cards).includes("1454"));
    // A configuração permanece para reaparecer somente se a origem voltar a ser pública.
    assert.equal((await detalhe()).cards_configuracao.length, 5);
    await attrs("agua", "Texto novamente público");
    assert.ok((await publico()).cards.some((c: any) => c.id === "vinculo"));
    await db.query("DELETE FROM fazenda_atributos WHERE fazenda_id=$1 AND chave='agua'", [id]);
    assert.ok(!(await publico()).cards.some((c: any) => c.id === "vinculo"));
    for (const texto of ["MunicípioReservado", "MunicipioReservado", "https://maps.app.goo.gl/secreto", "-16.9234, -43.1234", "MG-1234567-0123456789abcdef0123456789abcdef", "Área de 1454 ha", "1454"]) {
      const r = await admin.put(path, { cards: [editorial("segredo", { informacao: texto })] });
      assert.equal(r.status, 409, texto + " " + r.texto);
    }
    assert.equal((await detalhe()).cards_configuracao.length, 5); // rejeição não apaga coleção anterior
    // Mudança posterior do contexto privado suprime cards inseguros na leitura.
    await db.query("UPDATE fazendas SET municipio='Estrutura' WHERE id=$1", [id]);
    assert.ok(!(await publico()).cards.some((c: any) => c.id === "proprio"));
    await db.query("UPDATE fazendas SET municipio='MunicipioReservado' WHERE id=$1", [id]);
    // Salvar vazio é diferente de voltar a defaults; migração é idempotente.
    assert.equal((await admin.put(path, { cards: [] })).status, 200);
    await migrar(db);
    assert.deepEqual((await detalhe()).cards_configuracao, []);
    assert.deepEqual((await publico()).cards, []);
    assert.equal((await admin.get(`/api/admin/fazendas/${outroId}`)).json.fazenda.cards, null);
    assert.equal((await admin.put(path, { cards: [editorial("recriado", { titulo: "Acesso", informacao: "Texto revisado" })] })).status, 200);
    assert.equal((await publico()).cards[0].titulo, "Acesso");
    // Sigilo impede uma mudança privada que tornaria um texto editorial publicado sensível.
    assert.equal((await admin.put(`/api/admin/fazendas/${id}`, { municipio: "Acesso" })).status, 409);
    await db.query("UPDATE fazendas SET status='arquivada' WHERE id=$1", [id]);
    assert.equal((await cliente().get(`/api/public/fazendas/${slug}`)).status, 404);
    // CSRF continua obrigatório nas novas operações autenticadas.
    assert.equal((await fetch(t.base + path, { method: "PUT", headers: { "content-type": "application/json" }, body: '{"cards":[]}' })).status, 403);
  } finally { await t.fechar(); }
}
