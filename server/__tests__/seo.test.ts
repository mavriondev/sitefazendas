import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { subirApp, jpegComExif } from "./helpers";
import { seoPadrao, paginaSeoVazia } from "../../shared/seo";
import { validarSeo } from "../lib/seo";

export async function rodar() {
  assert.equal(validarSeo(seoPadrao()),null);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"sf-seo-html-"));
  fs.writeFileSync(path.join(dir,"index.html"),'<!doctype html><html><head><title>Antigo</title><!--OG--></head><body><div id="root"></div></body></html>');
  const t=await subirApp({clientDir:dir});
  try {
    const anon=t.cliente();
    assert.equal((await anon.get("/api/admin/seo")).status,401);
    assert.equal((await anon.put("/api/admin/seo",seoPadrao())).status,401);
    await t.db.query("INSERT INTO fazendas(titulo,slug,status,descricao_publica,notas_internas) VALUES('Fazenda SEO','fazenda-seo','publicada','Terra e água.','SEGREDO-PRIVADO'),('Fazenda reservada','reservada','rascunho','NAO-VAZAR','PRIVADO')");
    const cfg=seoPadrao();
    cfg.url_base="https://fazendas.exemplo.test";
    cfg.titulo_padrao="Fazendas para investir | Gramogol";
    cfg.descricao_padrao="Seleção de fazendas para investir com atendimento especializado.";
    cfg.google_verificacao="codigo_Google-123";
    cfg.bing_verificacao="BING123";
    cfg.paginas["/sobre"]={...paginaSeoVazia(),titulo:'Sobre "a empresa" <seguro>',descricao:"Nossa história e atendimento."};
    cfg.paginas["/contato"]={...paginaSeoVazia(),nao_indexar:true};
    cfg.paginas["/fazenda/fazenda-seo"]={...paginaSeoVazia(),titulo:"Fazenda para pecuária",descricao:"Descrição otimizada e revisada."};
    cfg.paginas["/fazenda/reservada"]={...paginaSeoVazia(),titulo:"TITULO-PRIVADO-SEO",descricao:"NAO-VAZAR-SEO"};
    const salvo=await t.admin.put("/api/admin/seo",cfg);
    assert.equal(salvo.status,200);
    assert.equal(salvo.json.revisao,1);
    assert.equal((await t.admin.put("/api/admin/seo",cfg)).status,409);
    const head=(await anon.get("/")).texto;
    assert.equal((head.match(/<title>/g)||[]).length,1);
    assert.ok(head.includes("<title>Fazendas para investir | Gramogol</title>"));
    assert.ok(head.includes('rel="canonical" href="https://fazendas.exemplo.test/"'));
    assert.ok(head.includes('name="google-site-verification" content="codigo_Google-123"'));
    assert.ok(head.includes('name="msvalidate.01" content="BING123"'));
    assert.ok(head.includes('property="og:title"'));
    assert.ok(head.includes('name="twitter:description"'));
    assert.ok(head.includes('type="application/ld+json"'));
    const sobre=(await anon.get("/sobre?campanha=teste")).texto;
    assert.ok(sobre.includes('Sobre &quot;a empresa&quot; &lt;seguro&gt;'));
    assert.ok(sobre.includes('href="https://fazendas.exemplo.test/sobre"'));
    assert.ok(!sobre.includes("campanha"));
    assert.equal((await anon.get("/sobre/")).status,200);
    const meta=(await anon.get("/api/public/seo?caminho=%2Fsobre")).json;
    assert.equal(meta.titulo,'Sobre "a empresa" <seguro>');
    assert.equal(meta.indexar,true);
    const contato=await fetch(t.base+"/contato");
    assert.equal(contato.headers.get("x-robots-tag"),"noindex, nofollow");
    assert.ok((await contato.text()).includes('content="noindex, nofollow"'));
    const farm=(await anon.get("/fazenda/fazenda-seo")).texto;
    assert.ok(farm.includes("Fazenda para pecuária"));
    assert.ok(!farm.includes("SEGREDO-PRIVADO"));
    // ficha em PDF: existe (200) para fazenda publicada, não é indexada; fazenda reservada continua 404
    const ficha=await fetch(t.base+"/fazenda/fazenda-seo/pdf");
    assert.equal(ficha.status,200); assert.equal(ficha.headers.get("x-robots-tag"),"noindex, nofollow");
    assert.equal((await fetch(t.base+"/fazenda/reservada/pdf")).status,404);
    assert.equal((await fetch(t.base+"/fazenda/inexistente/pdf")).status,404);
    const privada=await anon.get("/fazenda/reservada");
    assert.equal(privada.status,404);
    assert.ok(!privada.texto.includes("TITULO-PRIVADO-SEO"));
    assert.ok(!privada.texto.includes("NAO-VAZAR"));
    assert.equal((await anon.get("/pagina-inexistente")).status,404);
    assert.ok((await anon.get("/admin/seo")).texto.includes("noindex"));
    assert.equal((await anon.get("/api/public/seo?caminho=%2Ffazenda%2Freservada")).json.imagem,"");
    const sitemap=(await anon.get("/sitemap.xml")).texto;
    assert.ok(sitemap.includes("https://fazendas.exemplo.test/sobre"));
    assert.ok(sitemap.includes("fazenda-seo"));
    assert.ok(!sitemap.includes("/contato"));
    assert.ok(!sitemap.includes("reservada"));
    assert.ok(!sitemap.includes("/admin"));
    assert.ok((await anon.get("/robots.txt")).texto.includes("Sitemap: https://fazendas.exemplo.test/sitemap.xml"));
    for(const mudar of [
      (c:any)=>{c.url_base="javascript:alert(1)";},
      (c:any)=>{c.url_base="https://user:secret@example.test";},
      (c:any)=>{c.url_base="https://example.test/caminho";},
      (c:any)=>{c.url_base="https://example.test?x=1";},
      (c:any)=>{c.google_verificacao='<script src="evil"></script>';},
      (c:any)=>{c.titulo_padrao="x".repeat(161);},
      (c:any)=>{c.imagem_padrao="https://track.test/1.png";},
      (c:any)=>{c.paginas["/admin"]=paginaSeoVazia();},
      (c:any)=>{c.paginas["/sobre"].nao_indexar="sim";},
      (c:any)=>{c.paginas["/sobre"].imagem="/uploads/../../segredo";},
    ]) {
      const invalido=structuredClone(salvo.json);mudar(invalido);
      assert.equal((await t.admin.put("/api/admin/seo",invalido)).status,400);
    }
    const img=await t.admin.upload("/api/admin/seo/midias",jpegComExif());
    assert.equal(img.status,201);
    assert.equal((await anon.get(img.json.url)).status,404);
    assert.equal((await t.admin.get(img.json.url)).status,200);
    const imagem=(await t.admin.get("/api/admin/seo")).json;
    imagem.paginas["/fazenda/reservada"].imagem=img.json.url;
    assert.equal((await t.admin.put("/api/admin/seo",imagem)).status,200);
    assert.equal((await anon.get(img.json.url)).status,404);
    imagem.revisao++;
    imagem.paginas["/fazenda/fazenda-seo"].imagem=img.json.url;
    assert.equal((await t.admin.put("/api/admin/seo",imagem)).status,200);
    assert.equal((await anon.get(img.json.url)).status,200);
    assert.ok((await anon.get("/fazenda/fazenda-seo")).texto.includes(`content="https://fazendas.exemplo.test${img.json.url}"`));
    assert.equal((await t.admin.del(`/api/admin/seo/midias/${img.json.arquivo}`)).status,409);
    await t.db.query("UPDATE fazendas SET status='arquivada' WHERE slug='fazenda-seo'");
    assert.equal((await anon.get(img.json.url)).status,404);
    assert.ok(!(await anon.get("/sitemap.xml")).texto.includes("fazenda-seo"));
    const bloqueado=(await t.admin.get("/api/admin/seo")).json;
    bloqueado.bloquear_indexacao=true;
    bloqueado.paginas["/fazenda/reservada"].imagem="";
    bloqueado.paginas["/fazenda/fazenda-seo"].imagem="";
    assert.equal((await t.admin.put("/api/admin/seo",bloqueado)).status,200);
    assert.equal((await t.admin.del(`/api/admin/seo/midias/${img.json.arquivo}`)).status,200);
    assert.ok((await anon.get("/robots.txt")).texto.includes("Disallow: /"));
    assert.ok(!(await anon.get("/sitemap.xml")).texto.includes("<url>"));
    assert.equal((await anon.get("/api/public/seo?caminho=%2F")).json.indexar,false);
    await t.db.query("DELETE FROM fazendas WHERE slug='reservada'");
    const aposExcluir=(await t.admin.get("/api/admin/seo")).json;
    const limpeza=await t.admin.put("/api/admin/seo",aposExcluir);
    assert.equal(limpeza.status,200);
    assert.equal(limpeza.json.paginas["/fazenda/reservada"],undefined);
    const restaurar=seoPadrao();restaurar.revisao=(await t.admin.get("/api/admin/seo")).json.revisao;
    assert.equal((await t.admin.put("/api/admin/seo",restaurar)).status,200);
    const conc=(await t.admin.get("/api/admin/seo")).json;
    const concorrentes=await Promise.all([t.admin.put("/api/admin/seo",conc),t.admin.put("/api/admin/seo",conc)]);
    assert.deepEqual(concorrentes.map(x=>x.status).sort(),[200,409]);
  } finally {await t.fechar();fs.rmSync(dir,{recursive:true,force:true});}
}
