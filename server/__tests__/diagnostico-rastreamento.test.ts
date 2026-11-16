import assert from "node:assert/strict";
import { criarRastreadores, CAMINHO_DIAGNOSTICO } from "../../client/src/lib/rastreamento";
import { caminhoRastreavel, DURACAO_CONSENTIMENTO } from "../../shared/rastreamento";
import { subirApp } from "./helpers";
import { resolverSeo } from "../lib/seo";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export async function rodar() {
  const cfg = { ga4_id: "G-TEST123456", ga4_ativo: true, meta_pixel_id: "123456789012345", meta_pixel_ativo: true };
  const consent = { versao: 1 as const, analytics: true, marketing: true, expira: Date.now() + DURACAO_CONSENTIMENTO };
  const nomes = ["window", "document", "location", "setTimeout", "clearTimeout", "CustomEvent"];
  const antes = nomes.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  const scripts: any[] = [], eventos: any[] = [];
  const timers = new Set<() => void>();
  const w: any = { dispatchEvent: (e: unknown) => eventos.push(e) };
  try {
    const doc = {
      cookie: "", createElement: () => ({}),
      head: { appendChild: (s: any) => { s.remove = () => scripts.splice(scripts.indexOf(s), 1); scripts.push(s); } },
      getElementById: (id: string) => scripts.find(s => s.id === id),
    };
    for (const [k, value] of Object.entries({
      window: w, document: doc, location: { hostname: "teste.invalid", origin: "https://teste.invalid" },
      setTimeout: (f: () => void) => { timers.add(f); return f; },
      clearTimeout: (f: () => void) => timers.delete(f),
      CustomEvent: class { constructor(public type: string, public options: unknown) {} },
    })) Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
    assert.equal(caminhoRastreavel(CAMINHO_DIAGNOSTICO), false, "teste nunca deve receber consentimento automático");
    const normal = criarRastreadores(w);
    normal.atualizar(cfg, consent, CAMINHO_DIAGNOSTICO);
    assert.equal(scripts.length, 0);
    let mudancas = 0;
    const teste = criarRastreadores(w, () => mudancas++, true);
    teste.atualizar(cfg, null, CAMINHO_DIAGNOSTICO);
    teste.atualizar(cfg, { ...consent, analytics: false, marketing: false }, CAMINHO_DIAGNOSTICO);
    assert.equal(scripts.length, 0);
    teste.atualizar(cfg, { ...consent, marketing: false }, CAMINHO_DIAGNOSTICO);
    assert.equal(scripts.length, 1);
    assert.equal(teste.diagnostico().ga4, "carregando", "stub e fila não comprovam biblioteca carregada");
    assert.equal(teste.diagnostico().meta, "nao-iniciado");
    scripts[0].onload();
    assert.equal(teste.diagnostico().ga4, "carregada");
    teste.atualizar(cfg, consent, CAMINHO_DIAGNOSTICO);
    scripts[1].onerror();
    assert.equal(teste.diagnostico().meta, "erro");
    assert.equal(eventos[0].type, "gramogol:tracking-error");
    assert.deepEqual(eventos[0].options, { detail: "gramogol-meta" });
    assert.ok(mudancas >= 4);
    const chamadas = w.dataLayer.filter((x: any) => x[0] === "event");
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0][1], "page_view");
    assert.equal(chamadas[0][2].page_location, "https://teste.invalid" + CAMINHO_DIAGNOSTICO);
    assert.equal(teste.atualizar(cfg, { ...consent, analytics: false }, CAMINHO_DIAGNOSTICO), true);
    assert.equal(scripts.length, 0);
    assert.equal(timers.size, 0);
    const timeout = criarRastreadores({} as Window, () => {}, true);
    timeout.atualizar(cfg, consent, CAMINHO_DIAGNOSTICO);
    [...timers].forEach(f => f());
    assert.equal(timeout.diagnostico().ga4, "tempo-esgotado");
    assert.equal(timeout.diagnostico().meta, "tempo-esgotado");
    timeout.parar();
    assert.equal(timers.size, 0);
    const separado = criarRastreadores({} as Window, () => {}, true);
    separado.atualizar({ ...cfg, ga4_id: "invalido" }, consent, CAMINHO_DIAGNOSTICO);
    assert.equal(scripts.length, 1, "configuração inválida do GA não esconde o estado da Meta");
    assert.equal(separado.diagnostico().ga4, "nao-iniciado");
    assert.equal(separado.diagnostico().meta, "carregando");
    separado.parar();
    const privado = criarRastreadores({} as Window, () => {}, true);
    privado.atualizar(cfg, consent, "/admin/seo");
    privado.atualizar(cfg, consent, "/conta");
    assert.equal(scripts.length, 0);
  } finally {
    for (const [k, d] of antes) {
      if (d) Object.defineProperty(globalThis, k, d); else Reflect.deleteProperty(globalThis, k);
    }
  }
  const clientDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-diagnostico-"));
  fs.writeFileSync(path.join(clientDir, "index.html"), '<!doctype html><html><head><title>Teste</title><!--OG--></head><body><div id="root"></div></body></html>');
  const t = await subirApp({ clientDir });
  try {
    const meta = await resolverSeo(t.db, CAMINHO_DIAGNOSTICO);
    assert.equal(meta.status, 200);
    assert.equal(meta.indexar, false);
    assert.equal(meta.canonical, "");
    assert.match(meta.titulo, /Diagnóstico/);
    assert.ok(meta.descricao);
    const teste = await fetch(t.base + CAMINHO_DIAGNOSTICO);
    assert.equal(teste.status, 200);
    const html = await teste.text();
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(html, /<title>Diagnóstico/);
    assert.equal((await fetch(t.base + CAMINHO_DIAGNOSTICO + "/")).status, 200);
    assert.match(teste.headers.get("content-security-policy")!, /script-src 'self' https:\/\/www.googletagmanager.com https:\/\/connect.facebook.net/);
    const painel = await fetch(t.base + "/admin/seo");
    assert.match(painel.headers.get("content-security-policy")!, /script-src 'self';/);
    assert.equal((await resolverSeo(t.db, "/diagnostico-inexistente")).status, 404);
  } finally { await t.fechar(); fs.rmSync(clientDir, { recursive: true, force: true }); }
}
