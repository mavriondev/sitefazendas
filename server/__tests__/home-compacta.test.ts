import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { subirApp } from "./helpers";
import { sanitizarImagem } from "../lib/foto";
import { aplicarLimpezaParceiros, planejarLimpezaParceiros, hashPlanoParceiros } from "../lib/parceiros-demo";
import { destinoParceiros, parceirosDisponiveis } from "../../shared/parceiros";
import { conteudoPadrao } from "../../shared/conteudo";

export async function rodar() {
  const ctx = await subirApp();
  const { db, admin, cliente } = ctx;
  try {
    const publico = cliente();
    assert.deepEqual((await publico.get("/api/public/parceiros")).json.parceiros, []);
    const criado = await admin.post("/api/admin/parceiros", { nome: "Parceiro autorizado", ativo: true });
    assert.equal(criado.status, 201);
    const id = criado.json.id;
    assert.equal((await publico.get("/api/public/parceiros")).json.parceiros.length, 1);
    assert.equal((await admin.put(`/api/admin/parceiros/${id}`, { nome: "Parceiro autorizado", ativo: false })).status, 200);
    assert.deepEqual((await publico.get("/api/public/parceiros")).json.parceiros, []);
    await admin.put(`/api/admin/parceiros/${id}`, { nome: "Parceiro autorizado", ativo: true });
    const lista = (await publico.get("/api/public/parceiros")).json.parceiros;
    const conteudo = conteudoPadrao();
    assert.equal(parceirosDisponiveis([], conteudo.paginas), false);
    assert.equal(parceirosDisponiveis(lista, conteudo.paginas), true);
    conteudo.paginas.home.ocultas.push("parceiros");
    assert.equal(parceirosDisponiveis(lista, conteudo.paginas), false);
    conteudo.paginas.home.ocultas = [];
    conteudo.paginas.parceiros.ocultas.push("lista");
    assert.equal(parceirosDisponiveis(lista, conteudo.paginas), false);
    for (const href of ["/parceiros", "/parceiros/?origem=menu", "/#parceiros", "#parceiros", "https://site.test/parceiros"]) assert.equal(destinoParceiros(href), true);
    for (const href of ["/admin/parceiros", "/fazendas", "/parceiros-legais"]) assert.equal(destinoParceiros(href), false);

    const s = await admin.post("/api/admin/slides", { titulo: "Histórico preservado" });
    assert.equal(s.status, 201);
    await admin.put("/api/admin/config", { hero_titulo: "Título editorial personalizado", hero_subtitulo: "Texto personalizado." });
    const config = (await publico.get("/api/public/config")).json;
    assert.equal(config.hero_titulo, "Título editorial personalizado");
    assert.equal(config.hero_subtitulo, "Texto personalizado.");
    assert.equal((await admin.get("/api/admin/slides")).json.slides[0].titulo, "Histórico preservado");
    await db.query("INSERT INTO fazendas(slug,titulo) VALUES('preservada','Fazenda preservada')");

    const nomes = ["[EXEMPLO] Coop Verde", "Geo Campo", "Agro Crédito", "Trator Sul"];
    const logos = ["logo-cooperativa.png", "logo-topografia.png", "logo-credito.png", "logo-maquinas.png"];
    const urls = ["https://example.com/", null, "https://example.org/", null];
    for (let n = 0; n < 4; n++) {
      const bytes = sanitizarImagem(await fs.readFile(path.resolve("server/scripts/exemplo", logos[n])))!.dados;
      const arquivo = `${String(n + 1).padStart(32, "0")}.png`;
      await fs.writeFile(path.join(ctx.uploadsDir, arquivo), bytes);
      await db.query("INSERT INTO parceiros(nome,arquivo,url,ordem) VALUES($1,$2,$3,$4)", [nomes[n],arquivo,urls[n],n]);
    }
    const logo = `${"1".padStart(32,"0")}.png`;
    for (const [nome, arquivo, url] of [
      ["Coop Verde", null, "https://example.com/"], // ausência de logo não é prova
      ["Empresa legítima", logo, "https://example.com/"], // conteúdo editado
      ["Coop Verde", logo, "https://parceiro-autorizado.test/"], // URL editada
      ["Empresa desconhecida", null, null],
    ]) await db.query("INSERT INTO parceiros(nome,arquivo,url,ordem) VALUES($1,$2,$3,0)", [nome,arquivo,url]);
    const antes = (await db.query("SELECT * FROM parceiros ORDER BY id")).rows;
    const arquivos = await fs.readdir(ctx.uploadsDir);
    const plano = await planejarLimpezaParceiros(db, ctx.uploadsDir);
    assert.equal(plano.length, 4);
    assert.match(hashPlanoParceiros(plano), /^[a-f0-9]{64}$/);
    assert.deepEqual((await db.query("SELECT * FROM parceiros ORDER BY id")).rows, antes, "dry-run não escreve");
    await db.query("BEGIN");
    await aplicarLimpezaParceiros(db, plano);
    await db.query("COMMIT");
    assert.deepEqual((await db.query("SELECT * FROM parceiros ORDER BY id")).rows, antes.filter(p => !plano.some(d => d.id === p.id)));
    assert.deepEqual(await planejarLimpezaParceiros(db, ctx.uploadsDir), [], "limpeza repetível");
    assert.deepEqual(await fs.readdir(ctx.uploadsDir), arquivos, "uploads preservados, inclusive compartilhados");
    assert.equal((await db.query("SELECT * FROM fazendas")).rows.length, 1);
    assert.equal((await admin.get("/api/admin/slides")).json.slides.length, 1);
    await admin.del(`/api/admin/parceiros/${id}`);
    assert.equal((await admin.get("/api/admin/parceiros")).status, 200);
  } finally {
    await ctx.fechar();
    await fs.rm(ctx.uploadsDir, { recursive: true, force: true });
    if ("documentosDir" in ctx && typeof ctx.documentosDir === "string") await fs.rm(ctx.documentosDir, { recursive: true, force: true });
  }
}
