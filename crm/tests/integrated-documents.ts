import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fixture, message, PASSWORD, PDF, SOURCE_TABLES } from "./integration/fixture";

async function run() {
  const f = await fixture();
  try {
    const panel = f.panel(), crm = f.crmClient(), anonymous = f.crmClient();
    assert.equal((await panel("POST", "/auth/entrar", { email: "painel@integrado.test", senha: PASSWORD })).status, 200);
    assert.equal((await crm("POST", "/login", { email: "gestor@integrado.test", senha: PASSWORD })).status, 200);
    const created = await panel("POST", "/admin/fazendas", { titulo: "Fazenda exclusivamente sintética integrada" });
    assert.equal(created.status, 201);
    const farmId = created.json.id, farmRoute = `/farms/${farmId}`;
    assert.equal((await crm("POST", "/source/refresh", {})).status, 200);
    assert.deepEqual((await crm("GET", farmRoute)).json.documentos, [], "não existem documentos pré-semeados");

    // Papéis de equipe: a leitura deve respeitar a atribuição de fazendas.
    const users = [];
    for (const name of ["autorizado", "sem-acesso"]) {
      const result = await crm("POST", "/users", {
        nome: name, email: `${name}@integrado.test`, senha: PASSWORD, papel: "membro", request_key: crypto.randomUUID(),
      });
      assert.equal(result.status, 201); users.push(result.json);
    }
    assert.equal((await crm("PUT", `/users/${users[0].id}/access`, { fazenda_ids: [farmId], contato_ids: [] })).status, 200);
    const member = f.crmClient(), outsider = f.crmClient();
    for (const [user, name] of [[member, "autorizado"], [outsider, "sem-acesso"]] as const)
      assert.equal((await user("POST", "/login", { email: `${name}@integrado.test`, senha: PASSWORD })).status, 200);

    // Testa grants reais, também SEM a proteção de transação READ ONLY do adaptador.
    const identity = (await f.reader.query("SELECT current_user, rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0];
    assert.equal(identity.current_user, "source_reader"); assert.equal(identity.rolsuper, false);
    for (const table of SOURCE_TABLES) {
      const rights = (await f.reader.query("SELECT has_table_privilege(current_user,$1,'SELECT') AS leitura, has_table_privilege(current_user,$1,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS escrita", [table])).rows[0];
      assert.equal(rights.leitura, true); assert.equal(rights.escrita, false);
    }
    await f.reader.query("SET default_transaction_read_only=off");
    for (const sql of [
      "INSERT INTO fazenda_documentos(fazenda_id) VALUES(1)",
      "UPDATE fazenda_documentos SET descricao='indevido'",
      "DELETE FROM fazenda_documentos",
      "TRUNCATE fazenda_documentos",
      "CREATE TABLE public.indevido(id integer)",
      "SELECT * FROM usuarios",
    ]) await assert.rejects(() => f.reader.query(sql), { code: "42501" });
    console.log("PASS senha SCRAM validada, credencial SELECT-only e escrita/DDL recusadas pelo PostgreSQL");

    const panelRoute = `/admin/fazendas/${farmId}/documentos`;
    function form() {
      const data = new FormData();
      data.append("arquivo", new Blob([new Uint8Array(PDF)], { type: "application/pdf" }), "Matrícula sintética.pdf");
      data.append("categoria", "Matrícula"); data.append("descricao", "Documento descartável do teste integrado");
      return data;
    }
    assert.equal((await f.panel()("POST", panelRoute, form())).status, 401);
    assert.equal(process.umask(), 0o077);
    const upload = await panel("POST", panelRoute, form());
    assert.equal(upload.status, 201);
    const docId = upload.json.id, downloadRoute = `/documents/${docId}/download`;
    const stored = (await f.site.query("SELECT * FROM fazenda_documentos WHERE id=$1", [docId])).rows[0];
    const filename = stored.arquivo, file = path.join(f.docs, filename);
    assert.equal((await fs.stat(f.docs)).mode & 0o7777, 0o2750);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o640, "UMask 0077 não retira leitura do grupo privado");
    assert.deepEqual(await fs.readFile(file), PDF);
    assert.deepEqual(await fs.readdir(f.uploads), []);
    assert.equal((await f.panel()("GET", panelRoute)).status, 401);
    assert.equal((await f.panel()("GET", `/admin/documentos/${docId}/baixar`)).status, 401);
    const panelDownload = await panel("GET", `/admin/documentos/${docId}/baixar`);
    assert.equal(panelDownload.status, 200); assert.deepEqual(panelDownload.buffer, PDF);
    console.log("PASS painel criou o arquivo real em 0640 sob UMask 0077, fora dos uploads públicos");

    const before = await f.fingerprint();
    for (const user of [crm, member]) {
      const detail = await user("GET", farmRoute);
      assert.equal(detail.status, 200); assert.equal(detail.json.documentos_erro, false);
      assert.equal(detail.json.documentos.length, 1);
      const doc = detail.json.documentos[0];
      assert.equal(doc.id, docId); assert.equal(doc.nome, "Matrícula sintética.pdf");
      assert.equal(doc.categoria, upload.json.categoria); assert.equal(doc.descricao, upload.json.descricao);
      assert.equal(doc.tamanho, PDF.length); assert.ok(!("arquivo" in doc)); assert.ok(!("mime" in doc));
      const download = await user("GET", downloadRoute);
      assert.equal(download.status, 200); assert.deepEqual(download.buffer, PDF);
      assert.match(download.headers.get("content-type")!, /^application\/pdf/);
      assert.match(download.headers.get("content-disposition")!, /attachment/);
      assert.match(download.headers.get("cache-control")!, /no-store/);
      assert.match(download.headers.get("content-security-policy")!, /sandbox/);
    }
    assert.equal((await anonymous("GET", farmRoute)).status, 401);
    assert.equal((await anonymous("GET", downloadRoute)).status, 401);
    assert.equal((await outsider("GET", farmRoute)).status, 404);
    assert.equal((await outsider("GET", downloadRoute)).status, 404);
    for (const user of [crm, member]) {
      assert.equal((await user("POST", `${farmRoute}/documents`, form())).status, 404);
      assert.equal((await user("PUT", `/documents/${docId}`, { descricao: "indevido" })).status, 404);
      assert.equal((await user("DELETE", `/documents/${docId}`)).status, 404);
    }
    for (const route of [`/uploads/${filename}`, `/documentos/${filename}`])
      assert.equal((await fetch(f.siteBase + route)).status, 404);
    const probe = message(f.child, value => value.probe);
    f.child.send({ probe: true, file: filename });
    await probe;
    assert.equal(await f.fingerprint(), before, "leitura e tentativas de escrita do CRM preservam origem e arquivos");
    assert.ok((await f.crm.query("SELECT 1 FROM crm_events WHERE acao='Documento baixado'")).rowCount >= 2);
    console.log("PASS CRM leu imediatamente os mesmos bytes; anônimo/sem acesso bloqueados; montagem recusou cinco escritas com EROFS");

    // Nenhum refresh/import entre upload, leitura e remoção: documentos são sempre ao vivo.
    assert.equal((await f.panel()("DELETE", `/admin/documentos/${docId}`)).status, 401);
    assert.equal((await panel("DELETE", `/admin/documentos/${docId}`)).status, 200);
    assert.equal((await f.site.query("SELECT 1 FROM fazenda_documentos")).rowCount, 0);
    await assert.rejects(() => fs.stat(file), { code: "ENOENT" });
    for (const user of [crm, member]) {
      const detail = await user("GET", farmRoute);
      assert.equal(detail.status, 200); assert.equal(detail.json.documentos_erro, false);
      assert.deepEqual(detail.json.documentos, []);
      assert.equal((await user("GET", downloadRoute)).status, 404);
    }
    assert.equal((await panel("GET", `/admin/documentos/${docId}/baixar`)).status, 404);
    assert.deepEqual(await fs.readdir(f.docs), []);
    console.log("PASS exclusão pelo painel refletiu imediatamente na lista e no download do CRM");
  } finally { await f.close(); }
  await assert.rejects(() => fs.stat(f.dir), { code: "ENOENT" });
  console.log("PASS aplicações encerradas; cluster, bancos, senhas e arquivos sintéticos removidos");
}
run().catch(e => { console.error(e); process.exitCode = 1; });
