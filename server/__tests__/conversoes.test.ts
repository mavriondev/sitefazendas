import assert from "node:assert/strict";
import { conectarRastreadores, criarRastreadores, registrarInteracaoFazenda } from "../../client/src/lib/rastreamento";
import { DURACAO_CONSENTIMENTO, rastreamentoPadrao } from "../../shared/rastreamento";

/** IDs fictícios e provedores em memória: não acessa Google, Meta, Hub ou Connect. */
export async function rodar() {
  const cfg = { ga4_id: "G-TEST123456", ga4_ativo: true, meta_pixel_id: "123456789012345", meta_pixel_ativo: true };
  const consent = { versao: 1 as const, analytics: true, marketing: true, expira: Date.now() + DURACAO_CONSENTIMENTO };
  const anteriores = ["window", "document", "location"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  try {
    const scripts: any[] = [];
    const doc = {
      cookie: "", createElement: () => ({}),
      head: { appendChild: (s: any) => { s.remove = () => scripts.splice(scripts.indexOf(s), 1); scripts.push(s); } },
      getElementById: (id: string) => scripts.find(s => s.id === id),
    };
    const loc = { hostname: "teste.example", origin: "https://teste.example", pathname: "/fazenda/fazenda-teste", search: "", hash: "" };
    const w: any = { dispatchEvent() {} };
    for (const [k, v] of Object.entries({ window: w, document: doc, location: loc }))
      Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true });
    const r = criarRastreadores(w);
    const desligar = conectarRastreadores(r);
    const clique = () => new Event("click", { cancelable: true });
    const enviar = (e = clique()) => registrarInteracaoFazenda("whatsapp_click", "fazenda-teste", "tenho_interesse", e);
    const gaEventos = () => (w.dataLayer || []).filter((x: any) => x[0] === "event" && x[1] !== "page_view");
    const metaEventos = () => (w.fbq?.queue || []).filter((x: any) => x[0] === "trackSingleCustom");
    enviar(); assert.equal(gaEventos().length, 0);
    r.atualizar(cfg, null, loc.pathname); enviar(); assert.equal(scripts.length, 0);
    r.atualizar(cfg, { ...consent, analytics: false, marketing: false }, loc.pathname);
    enviar(); assert.equal(scripts.length, 0);
    r.atualizar(cfg, { ...consent, marketing: false }, loc.pathname);
    enviar(); assert.equal(gaEventos().length, 1); assert.equal(metaEventos().length, 0);
    r.atualizar(cfg, consent, loc.pathname);
    const evento = clique();
    enviar(evento); enviar(evento); // A mesma ativação não pode ser contada duas vezes.
    assert.equal(gaEventos().length, 2); assert.equal(metaEventos().length, 1);
    registrarInteracaoFazenda("whatsapp_click", "fazenda-teste", "whatsapp_flutuante", clique());
    registrarInteracaoFazenda("pdf_open", "fazenda-teste", "ficha_pdf", clique());
    assert.equal(gaEventos().length, 4); assert.equal(metaEventos().length, 3);
    assert.deepEqual(Object.keys(gaEventos()[3][2]).sort(), ["fazenda_slug", "origem", "page_location", "page_referrer", "send_to"]);
    assert.deepEqual(metaEventos()[2], ["trackSingleCustom", cfg.meta_pixel_id, "pdf_open", { fazenda_slug: "fazenda-teste", origem: "ficha_pdf" }]);
    const cancelado = clique(); cancelado.preventDefault(); enviar(cancelado);
    for (const slug of ["outra-fazenda", "../admin", "fazenda-teste?telefone=123", "fazenda-teste#car", ""])
      r.registrar("whatsapp_click", slug, "tenho_interesse");
    r.registrar("pdf_open", "fazenda-teste", "tenho_interesse");
    r.registrar("Lead" as any, "fazenda-teste", "tenho_interesse");
    assert.equal(gaEventos().length, 4); assert.equal(metaEventos().length, 3);
    // Parâmetros sensíveis nunca entram nos payloads; Meta não recebe a URL bruta.
    loc.search = "?telefone=segredo&car=segredo"; loc.hash = "#mensagem-segredo";
    enviar(); assert.equal(gaEventos().length, 5); assert.equal(metaEventos().length, 3);
    assert.equal(gaEventos()[4][2].page_location, "https://teste.example/fazenda/fazenda-teste");
    assert.ok(!JSON.stringify(gaEventos()).includes("segredo"));
    loc.search = ""; loc.hash = "";
    // Um provedor que lança erro não impede o outro nem propaga exceções ao link.
    const gtag = w.gtag; w.gtag = () => { throw Error("bloqueado"); };
    assert.doesNotThrow(() => enviar()); assert.equal(metaEventos().length, 4);
    w.gtag = gtag;
    const fbq = w.fbq; w.fbq = () => { throw Error("bloqueado"); };
    assert.doesNotThrow(() => enviar()); assert.equal(gaEventos().length, 6);
    w.fbq = fbq;
    r.atualizar(cfg, { ...consent, expira: Date.now() + 1 }, loc.pathname);
    await new Promise(ok => setTimeout(ok, 5));
    enviar(); assert.equal(gaEventos().length, 6); assert.equal(metaEventos().length, 4);
    r.atualizar(cfg, consent, loc.pathname);
    assert.equal(r.atualizar(rastreamentoPadrao(), consent, loc.pathname), true);
    enviar(); assert.equal(gaEventos().length, 6); assert.equal(metaEventos().length, 4);
    desligar(); enviar(); assert.equal(gaEventos().length, 6);

    // Nova instância: marketing isolado, desativação, troca de ID e área privada.
    const w2: any = {};
    const m = criarRastreadores(w2);
    m.atualizar(cfg, { ...consent, analytics: false }, loc.pathname);
    m.registrar("pdf_open", "fazenda-teste", "ficha_pdf");
    assert.ok(!w2.gtag);
    assert.equal(w2.fbq.queue.filter((x: any) => x[0] === "trackSingleCustom").length, 1);
    assert.equal(m.atualizar({ ...cfg, meta_pixel_id: "987654321000000" }, consent, loc.pathname), true);
    m.registrar("pdf_open", "fazenda-teste", "ficha_pdf");
    assert.equal(w2.fbq.queue.filter((x: any) => x[0] === "trackSingleCustom").length, 1);
    const w3: any = {}, privado = criarRastreadores(w3);
    loc.pathname = "/admin/seo"; privado.atualizar(cfg, consent, loc.pathname);
    privado.registrar("pdf_open", "fazenda-teste", "ficha_pdf");
    assert.ok(!w3.gtag && !w3.fbq);
    loc.pathname = "/fazenda/fazenda-teste";
    const w4: any = {}, semFlags = criarRastreadores(w4);
    semFlags.atualizar({ ...cfg, ga4_ativo: false, meta_pixel_ativo: false }, consent, loc.pathname);
    semFlags.registrar("pdf_open", "fazenda-teste", "ficha_pdf");
    assert.ok(!w4.gtag && !w4.fbq);
    const w5: any = {}, metaComParametros = criarRastreadores(w5);
    loc.search = "?car=segredo";
    metaComParametros.atualizar(cfg, consent, loc.pathname);
    assert.ok(!w5.fbq);
  } finally {
    for (const [k, d] of anteriores) { if (d) Object.defineProperty(globalThis, k, d); else Reflect.deleteProperty(globalThis, k); }
  }
}
