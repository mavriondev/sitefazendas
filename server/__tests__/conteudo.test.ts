import assert from "node:assert/strict";
import { subirApp, jpegComExif } from "./helpers";
import { conteudoPadrao, completarConteudo, PAGINAS_CONTEUDO } from "../../shared/conteudo";
import { validarConteudo } from "../lib/conteudo";

export async function rodar() {
  const padrao = conteudoPadrao();
  assert.equal(validarConteudo(padrao), null);
  assert.ok(PAGINAS_CONTEUDO.length >= 10);
  const antigo = conteudoPadrao();
  delete antigo.paginas.home.valores["convite.titulo"];
  assert.equal(completarConteudo(antigo).paginas.home.valores["convite.titulo"], padrao.paginas.home.valores["convite.titulo"]);
  const t = await subirApp();
  try {
    const anon = t.cliente();
    assert.equal((await anon.get("/api/admin/conteudo")).status, 401);
    assert.equal((await anon.put("/api/admin/conteudo", padrao)).status, 401);
    const comprador = t.cliente();
    await comprador.post("/api/auth/registrar", { nome: "Editor não autorizado", email: "cms@teste.com", whatsapp: "31999990001", senha: "senha-de-teste-123", aceite: true });
    assert.equal((await comprador.get("/api/admin/conteudo")).status, 403);
    assert.equal((await comprador.put("/api/admin/conteudo", padrao)).status, 403);
    assert.equal((await comprador.upload("/api/admin/conteudo/midias", jpegComExif())).status, 403);
    assert.deepEqual((await anon.get("/api/public/conteudo")).json, padrao);
    const original = (await t.admin.get("/api/admin/conteudo")).json;
    const alterado = structuredClone(original);
    alterado.paginas.home.valores["destaques.titulo"] = "Seleção do administrador";
    alterado.paginas.home.ocultas = ["etapas"];
    alterado.paginas.home.ordem = ["hero","busca","sobre","destaques","etapas","venda","parceiros","convite"];
    const salvo = await t.admin.put("/api/admin/conteudo", alterado);
    assert.equal(salvo.status, 200);
    assert.equal(salvo.json.revisao, 1);
    const publico = (await anon.get("/api/public/conteudo")).json;
    assert.equal(publico.paginas.home.valores["destaques.titulo"], "Seleção do administrador");
    assert.deepEqual(publico.paginas.home.ocultas, ["etapas"]);
    assert.equal(publico.paginas.home.ordem[2], "sobre");
    assert.equal((await t.admin.put("/api/admin/conteudo", original)).status, 409);

    for (const mutacao of [
      (d: any) => { d.paginas.global.valores["menu_inicio.link"] = "javascript:alert(1)"; },
      (d: any) => { d.paginas.global.valores["menu_inicio.link"] = "//evil.test"; },
      (d: any) => { d.paginas.global.valores["menu_inicio.link"] = "/%5cevil.test"; },
      (d: any) => { d.paginas.global.valores["marca.logo"] = "https://tracker.test/logo.png"; },
      (d: any) => { d.paginas.global.valores["marca.logo"] = "/uploads/../../segredo"; },
      (d: any) => { d.paginas.global.valores["marca.botao"] = "x".repeat(251); },
      (d: any) => { d.paginas.home.ocultas = ["secao-inventada"]; },
      (d: any) => { d.paginas.home.ordem[0] = "busca"; },
      (d: any) => { d.paginas.formularios.ocultas = ["rotulos"]; },
      (d: any) => { d.paginas.inventada = d.paginas.home; },
    ]) {
      const invalido = structuredClone(salvo.json);
      mutacao(invalido);
      assert.equal((await t.admin.put("/api/admin/conteudo", invalido)).status, 400);
    }
    // Uma marcação em campo de texto é conteúdo literal, nunca HTML executável.
    const literal = structuredClone(salvo.json);
    literal.paginas.contato.valores["topo.titulo"] = '<script>alert("literal")</script>';
    assert.equal((await t.admin.put("/api/admin/conteudo", literal)).status, 200);
    assert.equal((await anon.get("/api/public/conteudo")).json.paginas.contato.valores["topo.titulo"], literal.paginas.contato.valores["topo.titulo"]);

    assert.equal((await t.admin.upload("/api/admin/conteudo/midias", Buffer.from("<svg>bad</svg>"), "logo.png", "image/png")).status, 400);
    const upload = await t.admin.upload("/api/admin/conteudo/midias", jpegComExif());
    assert.equal(upload.status, 201);
    assert.equal(upload.json.publicado, false);
    const url = upload.json.url;
    assert.equal((await anon.get(url)).status, 404);
    const privado = await t.admin.get(url);
    assert.equal(privado.status, 200);
    assert.ok(!privado.texto.includes("GPSLatitude"));
    const lista = await t.admin.get("/api/admin/conteudo/midias");
    assert.equal(lista.json.midias[0].url, url);
    const imagem = (await t.admin.get("/api/admin/conteudo")).json;
    imagem.paginas.global.valores["marca.logo"] = url;
    assert.equal((await t.admin.put("/api/admin/conteudo", imagem)).status, 200);
    assert.equal((await anon.get(url)).status, 200);
    assert.equal((await t.admin.del(`/api/admin/conteudo/midias/${upload.json.arquivo}`)).status, 409);
    const remover = (await t.admin.get("/api/admin/conteudo")).json;
    remover.paginas.global.valores["marca.logo"] = padrao.paginas.global.valores["marca.logo"];
    assert.equal((await t.admin.put("/api/admin/conteudo", remover)).status, 200);
    assert.equal((await anon.get(url)).status, 404);
    assert.equal((await t.admin.del(`/api/admin/conteudo/midias/${upload.json.arquivo}`)).status, 200);
    assert.equal((await t.admin.get(url)).status, 404);
    const restaurar = conteudoPadrao();
    restaurar.revisao = (await t.admin.get("/api/admin/conteudo")).json.revisao;
    assert.equal((await t.admin.put("/api/admin/conteudo", restaurar)).status, 200);
    const restaurado = (await anon.get("/api/public/conteudo")).json;
    delete restaurado.revisao;
    const esperado: any = conteudoPadrao(); delete esperado.revisao;
    assert.deepEqual(restaurado, esperado);
    const a = (await t.admin.get("/api/admin/conteudo")).json;
    const paralelo = await Promise.all([t.admin.put("/api/admin/conteudo", a), t.admin.put("/api/admin/conteudo", a)]);
    assert.deepEqual(paralelo.map(x => x.status).sort(), [200,409]);
  } finally { await t.fechar(); }
}
