import assert from "node:assert/strict";
import { subirApp } from "./helpers";
import { atualizarAgro, configAgro, dolarAgro } from "../lib/agro";
import { buscarTexto, lerDolar, lerFeedCanal, lerMateriaMapa, linksMapa, textoPlano, urlFonte, MAPA_URL, CANAL_FEED, DOLAR_URL } from "../lib/agro-fontes";
import { resolverSeo } from "../lib/seo";

const url = MAPA_URL + "/noticia-de-teste";
const html = `<html><a rel="license" href="https://creativecommons.org/licenses/by-nd/3.0/deed.pt_BR">Licença</a><h1 class="documentFirstHeading">Produção agrícola</h1><p class="documentDescription">Informação oficial.</p><div class="documentPublished"><span class="value">23/10/2026 09h30</span></div><div id="parent-fieldname-text"><p>Texto autorizado para teste.</p><h2>Resultados</h2><table><tr><th>Safra</th><th>Valor</th></tr><tr><td>2026</td><td>10</td></tr></table><script>alert(1)</script><img src="https://terceiro.invalid/foto.jpg"></div></html>`;
const feed = `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>Notícia do portal</title><link>https://www.canalrural.com.br/agricultura/noticia-de-teste/</link><description><![CDATA[<p>Breve apresentação da fonte.</p><script>malicioso()</script>]]></description><content:encoded>NAO-IMPORTAR-INTEGRA</content:encoded><pubDate>Fri, 23 Oct 2026 12:00:00 GMT</pubDate></item><item><title>Privado</title><link>https://127.0.0.1/segredo</link></item></channel></rss>`;
export async function rodar() {
  assert.equal(textoPlano("<p>A &amp; B</p><script>segredo()</script>"), "A & B");
  for (const proibida of ["http://www.gov.br/agricultura/pt-br/assuntos/noticias/a", "https://www.gov.br@127.0.0.1/a", "https://www.gov.br.evil.invalid/agricultura/pt-br/assuntos/noticias/a", "https://www.gov.br:8080/agricultura/pt-br/assuntos/noticias/a", "https://www.gov.br/agricultura/pt-br/assuntos/noticias/a?q=segredo"]) assert.equal(urlFonte(proibida, "mapa"), null);
  assert.throws(() => lerFeedCanal('<!DOCTYPE rss [<!ENTITY a "b">]><rss/>'));
  const noticias = lerFeedCanal(feed);
  assert.equal(noticias.length, 1);
  assert.equal(noticias[0].formato, "resumo");
  assert.deepEqual(noticias[0].corpo, []);
  assert.equal(noticias[0].resumo_fonte, "Breve apresentação da fonte.");
  assert.ok(!JSON.stringify(noticias).includes("NAO-IMPORTAR"));
  assert.deepEqual(linksMapa(`<h2 class="tileHeadline"><a href="${url}">Notícia</a></h2><a href="http://127.0.0.1/">segredo</a>`), [url]);
  assert.deepEqual(linksMapa(`<article><a href="${url}">Cartão novo</a><a href="http://127.0.0.1/">segredo</a></article>`), [url]);
  const autorizada = lerMateriaMapa(html, url);
  assert.equal(autorizada.formato, "integral");
  assert.ok(autorizada.corpo.includes("2026 | 10"));
  assert.ok(!JSON.stringify(autorizada).includes("alert(1)"));
  assert.ok(!JSON.stringify(autorizada).includes("terceiro.invalid"));
  assert.equal(lerMateriaMapa(html.replace('rel="license"', 'rel="outra"'), url).formato, "resumo");
  assert.deepEqual(lerMateriaMapa(html.replace("Texto autorizado", "Reprodução proibida. Texto"), url).corpo, []);
  const cotacao = '[{"data":"22/10/2026","valor":"5.0"},{"data":"23/10/2026","valor":"5.5"}]';
  assert.ok(Math.abs(lerDolar(cotacao, new Date("2026-10-23T20:00:00Z")).variacao! - 10) < 0.001);
  assert.throws(() => lerDolar('[{"data":"23/10/2026","valor":"0"}]'));
  assert.throws(() => lerDolar("[]"));
  await assert.rejects(() => buscarTexto(MAPA_URL, (async () => new Response("muito", { headers: { "content-length": "3000000" } })) as typeof fetch));

  let chamadas = 0, quebrar = false;
  const buscar = (async (input: any) => {
    chamadas++;
    if (quebrar) return new Response("indisponível", { status: 503 });
    const u = String(input);
    if (u === MAPA_URL) return new Response(`<h2 class="tileHeadline"><a href="${url}">Notícia</a></h2>`);
    if (u === url) return new Response(html);
    if (u === CANAL_FEED) return new Response(feed);
    if (u === DOLAR_URL) return new Response(cotacao);
    throw Error("destino_nao_permitido");
  }) as typeof fetch;
  const t = await subirApp({ fetchAgro: buscar });
  try {
    const anon = t.cliente();
    assert.equal((await anon.get("/api/admin/agro")).status, 401);
    for (const id of ["127", "130", "28", "120"]) {
      assert.equal((await anon.get(`/mercado-widget/${id}`)).status, 404);
    }
    assert.equal((await anon.post("/api/admin/agro/atualizar")).status, 401);
    assert.equal((await anon.put("/api/admin/noticias/1", {})).status, 401);
    assert.equal((await t.admin.put("/api/admin/agro", { noticias_ativas: "true" })).status, 400);
    const p = atualizarAgro(t.db, buscar, true);
    assert.strictEqual(atualizarAgro(t.db, buscar, true), p);
    assert.deepEqual((await p).falhas, []);
    const antes = chamadas;
    await atualizarAgro(t.db, buscar);
    assert.equal(chamadas, antes);
    const lista = await anon.get("/api/public/noticias");
    assert.equal(lista.status, 200); assert.equal(lista.json.total, 2);
    const n = lista.json.noticias.find((v: any) => v.fonte === "mapa");
    assert.equal((await anon.get("/api/public/noticias/" + n.slug)).json.noticia.formato, "integral");
    assert.equal((await anon.get("/api/public/noticias?pagina=NaN")).status, 400);
    assert.equal((await anon.get("/api/public/noticias/inexistente")).status, 404);
    const seo = await resolverSeo(t.db, "/noticias/" + n.slug, "https://portal.teste.example");
    assert.equal(seo.status, 200); assert.equal(seo.canonical, url); assert.match(seo.titulo, /Produção agrícola/);
    assert.equal((await resolverSeo(t.db, "/noticias/inexistente")).status, 404);
    assert.equal((await resolverSeo(t.db, "/noticias")).status, 200);
    assert.equal((await t.admin.put("/api/admin/noticias/" + n.id, { chamada: "", resumo: "", ativo: true, ordem: 1, titulo: "Alterado" })).status, 400);
    assert.equal((await t.admin.put("/api/admin/noticias/" + n.id, { chamada: "Chamada editorial", resumo: "Apresentação própria.", ativo: false, ordem: 2 })).status, 200);
    await t.admin.post("/api/admin/agro/atualizar");
    const editada = (await t.admin.get("/api/admin/agro")).json.noticias.find((v: any) => v.id === n.id);
    assert.equal(editada.chamada, "Chamada editorial"); assert.equal(editada.ativo, false); assert.equal(editada.resumo, "Apresentação própria.");
    assert.equal((await anon.get("/api/public/noticias/" + n.slug)).status, 404);
    assert.equal((await resolverSeo(t.db, "/noticias/" + n.slug)).status, 404);
    assert.equal((await t.admin.get("/api/admin/agro")).json.noticias.length, 2);
    quebrar = true;
    assert.equal((await t.admin.post("/api/admin/agro/atualizar")).json.estado.falhas.length, 3);
    const posFalha = chamadas;
    await atualizarAgro(t.db, buscar); assert.equal(chamadas, posFalha);
    assert.equal((await dolarAgro(t.db))?.valor, 5.5);
    assert.equal((await dolarAgro(t.db))?.desatualizado, true);
    assert.equal((await t.admin.get("/api/admin/agro")).json.noticias.length, 2);
    const config = { ...(await configAgro(t.db)), canal_rural_ativo: false, cotacoes_ativas: false };
    assert.equal((await t.admin.put("/api/admin/agro", config)).status, 200);
    assert.equal((await anon.get("/api/public/noticias")).json.total, 0);
    assert.equal((await anon.get("/api/public/agro")).json.dolar, null);
    assert.equal((await anon.get("/mercado-widget/127")).status, 404);
    assert.equal((await anon.get("/mercado-widget/999")).status, 404);
  } finally { await t.fechar(); }
}
