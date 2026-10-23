import assert from "node:assert/strict";
import { subirApp } from "./helpers";
import { seoPadrao } from "../../shared/seo";
import { caminhoRastreavel, DURACAO_CONSENTIMENTO, lerConsentimento, rastreamentoPadrao, validarRastreamento } from "../../shared/rastreamento";
import { criarRastreadores } from "../../client/src/lib/rastreamento";

export async function rodar() {
  const cfg = { ga4_id: "G-TEST123456", ga4_ativo: true, meta_pixel_id: "123456789012345", meta_pixel_ativo: true };
  assert.equal(validarRastreamento(cfg), null);
  for (const c of [{ ...cfg, ga4_id: "<script>alert(1)</script>" }, { ...cfg, meta_pixel_id: "123?evil=1" }, { ...cfg, ga4_ativo: "true" }, { ...cfg, codigo: "alert(1)" }, { ...cfg, ga4_id: "" }, { ...cfg, meta_pixel_id: "" }]) assert.ok(validarRastreamento(c));
  for (const p of ["/", "/fazendas", "/fazenda/teste"]) assert.ok(caminhoRastreavel(p));
  for (const p of ["/admin", "/admin/seo", "/entrar", "/conta", "/cadastro", "/pesquisa", "/fazenda/teste/pdf", "/api/public/rastreamento"]) assert.ok(!caminhoRastreavel(p));
  const consent = { versao: 1 as const, analytics: true, marketing: true, expira: Date.now() + DURACAO_CONSENTIMENTO };
  assert.ok(lerConsentimento(JSON.stringify(consent)));
  for (const s of ["bad", "null", JSON.stringify({ ...consent, analytics: "yes" }), JSON.stringify({ ...consent, expira: 0 }), JSON.stringify({ ...consent, expira: Date.now() + 2 * DURACAO_CONSENTIMENTO })]) assert.equal(lerConsentimento(s), null);

  // Exercita o runtime sem rede, cookies reais ou serviços externos.
  const anteriores = ["window", "document", "location"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  try {
    const scripts: any[] = [];
    const doc = { cookie: "", createElement: () => ({}), head: { appendChild: (s: any) => { s.remove = () => scripts.splice(scripts.indexOf(s), 1); scripts.push(s); } }, getElementById: (id: string) => scripts.find(s => s.id === id) };
    const w: any = { dispatchEvent() {} };
    for (const [k, v] of Object.entries({ window: w, document: doc, location: { hostname: "teste.example", origin: "https://teste.example" } })) Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true });
    const r = criarRastreadores(w);
    assert.equal(r.atualizar(cfg, null, "/"), false); assert.equal(scripts.length, 0);
    r.atualizar(cfg, { ...consent, analytics: false, marketing: false }, "/"); assert.equal(scripts.length, 0);
    r.atualizar(cfg, { ...consent, marketing: false }, "/"); assert.equal(scripts.length, 1); assert.ok(!w.fbq);
    assert.equal(w.dataLayer.filter((x: any) => x[0] === "event").length, 1);
    r.atualizar(cfg, { ...consent, marketing: false }, "/"); assert.equal(w.dataLayer.filter((x: any) => x[0] === "event").length, 1);
    r.atualizar(cfg, consent, "/sobre"); assert.equal(scripts.length, 2);
    assert.equal(w.dataLayer.filter((x: any) => x[0] === "event").length, 2);
    assert.equal(w.fbq.queue.filter((x: any) => x[0] === "trackSingle").length, 1);
    assert.equal(r.atualizar({ ...cfg, ga4_id: "G-NEW1234567" }, consent, "/sobre"), true);
    assert.equal(w["ga-disable-" + cfg.ga4_id], true); assert.equal(scripts.length, 0);
    const w2: any = {};
    const marketing = criarRastreadores(w2);
    marketing.atualizar(cfg, { ...consent, analytics: false }, "/"); assert.ok(w2.fbq); assert.ok(!w2.gtag);
    assert.equal(marketing.atualizar(cfg, consent, "/admin/seo"), true);
  } finally {
    for (const [k, d] of anteriores) { if (d) Object.defineProperty(globalThis, k, d); else Reflect.deleteProperty(globalThis, k); }
  }
  const t = await subirApp();
  try {
    const anon = t.cliente();
    assert.deepEqual((await anon.get("/api/public/rastreamento")).json, rastreamentoPadrao());
    const seo = seoPadrao(); seo.rastreamento = cfg;
    assert.equal((await anon.put("/api/admin/seo", seo)).status, 401);
    assert.equal((await t.admin.put("/api/admin/seo", seo)).status, 200);
    assert.deepEqual((await anon.get("/api/public/rastreamento")).json, cfg);
    const pub = await fetch(t.base + "/api/public/rastreamento");
    assert.match(pub.headers.get("cache-control")!, /no-store/);
    const body = (await t.admin.get("/api/admin/seo")).json;
    for (const c of [{ ...cfg, ga4_id: "<script>" }, { ...cfg, meta_pixel_id: "javascript:alert(1)" }]) assert.equal((await t.admin.put("/api/admin/seo", { ...body, rastreamento: c })).status, 400);
    assert.equal((await t.admin.put("/api/admin/seo", { ...body, rastreamento: rastreamentoPadrao() })).status, 200);
    assert.deepEqual((await anon.get("/api/public/rastreamento")).json, rastreamentoPadrao());
    const legado = { ...seoPadrao() } as any; delete legado.rastreamento;
    await t.db.query("UPDATE configuracoes SET valor=$1::jsonb WHERE chave='seo_site'", [JSON.stringify(legado)]);
    assert.deepEqual((await t.admin.get("/api/admin/seo")).json.rastreamento, rastreamentoPadrao());
    assert.deepEqual((await anon.get("/api/public/rastreamento")).json, rastreamentoPadrao());
    const headers = (await fetch(t.base + "/admin/seo")).headers.get("content-security-policy")!;
    assert.match(headers, /script-src 'self';/); assert.ok(!headers.includes("unsafe-eval"));
  } finally { await t.fechar(); }
}
