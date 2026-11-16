import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { subirApp } from "./helpers";
import { inspecionarDocumento, nomeSeguro } from "../lib/documentos";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");

export async function rodar() {
  // Inspeção do arquivo: só PDF simples, JPEG e PNG; nada ativo.
  assert.equal(inspecionarDocumento(PDF, "matricula.pdf").ok, true);
  for (const ruim of ["%PDF-1.4\n/Java#53cript\n%%EOF\n", "%PDF-1.4\n/ObjStm\n%%EOF\n", "%PDF-1.4\n/Encrypt\n%%EOF\n", "%PDF-1.4\n/EmbeddedFile\n%%EOF\n"])
    assert.equal(inspecionarDocumento(Buffer.from(ruim), "a.pdf").ok, false);
  assert.equal(inspecionarDocumento(Buffer.from("<script>x</script>"), "a.pdf").ok, false);
  assert.equal(inspecionarDocumento(PDF, "a.html").ok, false);
  assert.equal(inspecionarDocumento(Buffer.from("não é imagem"), "a.png").ok, false);
  assert.equal(nomeSeguro("../../etc/passwd.pdf", ".pdf"), "passwd.pdf");
  assert.equal(nomeSeguro("Matrícula nº 12.345.pdf", ".pdf"), "Matrícula no 12.345.pdf");

  const t = await subirApp();
  try {
    const { admin, cliente, db, base, documentosDir, uploadsDir } = t;
    const id = (await admin.post("/api/admin/fazendas", { titulo: "Fazenda de teste de documentos" })).json.id;
    const rota = `/api/admin/fazendas/${id}/documentos`;
    const campos = { categoria: "Matrícula", descricao: "Matrícula 12.345" };

    // Só o administrador envia/lista/baixa/remove.
    assert.equal((await cliente().upload(rota, PDF, "m.pdf", "application/pdf", campos)).status, 401);
    assert.equal((await cliente().get(rota)).status, 401);
    // Validações.
    assert.equal((await admin.upload(rota, PDF, "m.pdf", "application/pdf", {})).status, 400);
    assert.equal((await admin.upload(rota, PDF, "m.pdf", "application/pdf", { categoria: "Qualquer" })).status, 400);
    assert.equal((await admin.upload(rota, Buffer.from("<script>bad</script>"), "fake.pdf", "application/pdf", campos)).status, 415);
    assert.equal((await admin.upload(rota, PDF, "teste.html", "text/html", campos)).status, 415);
    assert.equal((await admin.upload(rota, Buffer.alloc(12 * 1024 * 1024 + 1), "grande.pdf", "application/pdf", campos)).status, 413);
    assert.equal((await admin.upload("/api/admin/fazendas/999999/documentos", PDF, "m.pdf", "application/pdf", campos)).status, 404);
    assert.deepEqual(fs.readdirSync(documentosDir), []);

    const ok = await admin.upload(rota, PDF, "Matrícula 12.345.pdf", "application/pdf", campos);
    assert.equal(ok.status, 201, ok.texto);
    const doc = ok.json;
    assert.equal(doc.categoria, "Matrícula"); assert.equal(doc.nome, "Matrícula 12.345.pdf");
    assert.ok(!("arquivo" in doc), "o nome físico não vai ao navegador");
    const arquivos = fs.readdirSync(documentosDir); assert.equal(arquivos.length, 1);
    assert.match(arquivos[0], /^[a-f0-9]{48}\.pdf$/);
    assert.equal(fs.statSync(path.join(documentosDir, arquivos[0])).mode & 0o077, 0, "arquivo só do dono");

    const lista = (await admin.get(rota)).json.documentos;
    assert.equal(lista.length, 1); assert.ok(!("arquivo" in lista[0]));
    assert.equal((await admin.get(`/api/admin/fazendas/${id}`)).json.documentos.length, 1);

    // Download: só admin, anexo, sem cache, sem rastreio.
    const baixar = await admin.get(`/api/admin/documentos/${doc.id}/baixar`);
    assert.equal(baixar.status, 200);
    assert.match(baixar.headers.get("content-disposition") ?? "", /attachment/);
    assert.match(baixar.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(baixar.headers.get("content-type")?.split(";")[0], "application/pdf");
    assert.equal((await cliente().get(`/api/admin/documentos/${doc.id}/baixar`)).status, 401);
    assert.equal((await admin.get("/api/admin/documentos/999999/baixar")).status, 404);

    // Nunca público: nem na ficha, nem em /uploads, nem por nome de arquivo.
    const slug = (await admin.get(`/api/admin/fazendas/${id}`)).json.fazenda.slug;
    await db.query("UPDATE fazendas SET status='publicada' WHERE id=$1", [id]);
    const publica = (await cliente().get(`/api/public/fazendas/${slug}`)).texto;
    assert.ok(!publica.includes(arquivos[0]) && !publica.includes("Matrícula 12.345"), "ficha pública não traz arquivo nem nome do documento");
    assert.ok(!("documentos" in JSON.parse(publica)), "ficha pública não tem lista de documentos");
    assert.equal((await fetch(`${base}/uploads/${arquivos[0]}`)).status, 404);
    assert.equal((await fetch(`${base}/documentos/${arquivos[0]}`)).status === 200, false);
    assert.ok(!fs.existsSync(path.join(uploadsDir, arquivos[0])), "documentos não ficam em UPLOADS_DIR");
    await db.query("UPDATE fazendas SET status='rascunho' WHERE id=$1", [id]);

    // Remover apaga registro e arquivo.
    assert.equal((await cliente().del(`/api/admin/documentos/${doc.id}`)).status, 401);
    assert.equal((await admin.del(`/api/admin/documentos/${doc.id}`)).status, 200);
    assert.deepEqual(fs.readdirSync(documentosDir), []);
    assert.equal((await admin.get(`/api/admin/documentos/${doc.id}/baixar`)).status, 404);
    assert.equal((await admin.del(`/api/admin/documentos/${doc.id}`)).status, 404);

    // Excluir a fazenda apaga os documentos do disco.
    assert.equal((await admin.upload(rota, PDF, "a.pdf", "application/pdf", { categoria: "CAR" })).status, 201);
    assert.equal(fs.readdirSync(documentosDir).length, 1);
    assert.equal((await admin.del(`/api/admin/fazendas/${id}`)).status, 200);
    assert.deepEqual(fs.readdirSync(documentosDir), []);
    assert.equal((await db.query("SELECT 1 FROM fazenda_documentos")).rowCount, 0);
  } finally { await t.fechar(); }
}
