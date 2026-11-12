import assert from "node:assert/strict";
import crypto from "node:crypto";
import { fixture, TEST_PASSWORD, PDF, PNG, PHOTO } from "./fixture";
import { inspectDocument } from "../server/documents";
import { PgSource } from "../server/source";
import type pg from "pg";
async function run() {
  const f = await fixture(); const admin = f.client(), anon = f.client();
  const before = await f.sourceFingerprint();
  const counts: string[] = [];
  try {
    assert.equal((await anon.get("/contacts")).status, 401);
    assert.equal((await anon.req("POST", "/login", { email: "gestor@crm.test", senha: TEST_PASSWORD }, false)).status, 403);
    assert.equal((await admin.post("/login", { email: "gestor@crm.test", senha: TEST_PASSWORD })).status, 200);
    assert.equal((await admin.get("/me")).json.usuario.papel, "admin");
    const cookie = (await f.client().get("/csrf")).headers.get("set-cookie") || "";
    assert.match(cookie, /gramogol\.crm\.sid=/); assert.match(cookie, /Path=\/crm/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
    const userReq = { nome: "Ana Ferreira", email: "ana@crm.test", senha: TEST_PASSWORD, request_key: crypto.randomUUID() };
    const member = (await admin.post("/users", userReq)).json;
    assert.ok(member.id); assert.equal((await admin.post("/users", userReq)).json.id, member.id);
    const other = (await admin.post("/users", { ...userReq, nome: "Bruno", email: "bruno@crm.test", request_key: crypto.randomUUID() })).json;
    const m = f.client(), outsider = f.client();
    await m.post("/login", { email: member.email, senha: TEST_PASSWORD }); await outsider.post("/login", { email: other.email, senha: TEST_PASSWORD });
    assert.equal((await m.get("/farms")).json.fazendas.length, 0);
    assert.equal((await m.get("/farms/1")).status, 404);
    assert.equal((await m.post("/source/refresh", {})).status, 403);
    assert.equal((await m.post("/users", userReq)).status, 403);
    await admin.put(`/users/${member.id}/access`, { fazenda_ids: [1], contato_ids: [] });
    assert.equal((await m.get("/farms")).json.fazendas.length, 1);
    assert.equal((await m.get("/farms/2")).status, 404);
    const photo = await m.get("/farms/1/photos/" + PHOTO); assert.equal(photo.status, 200); assert.deepEqual(photo.buffer, PNG);
    assert.equal(photo.buffer.readUInt32BE(16), 800); assert.equal(photo.buffer.readUInt32BE(20), 450);
    assert.equal((await outsider.get("/farms/1/photos/" + PHOTO)).status, 404);
    counts.push("login, CSRF, cookies e permissões por fazenda/equipe");
    const contactBody = { nome: "Carolina", telefone: "34999990000", email: "carolina@crm.test", origem: "WhatsApp", observacoes: "Preferência por pecuária.", responsavel_id: member.id, fazenda_ids: [1], request_key: crypto.randomUUID() };
    const created = await m.post("/contacts", contactBody); assert.equal(created.status, 201, created.text); const c = created.json;
    assert.equal((await m.post("/contacts", contactBody)).json.id, c.id);
    assert.equal((await outsider.get(`/contacts/${c.id}`)).status, 404);
    assert.equal((await outsider.get("/contacts")).json.contatos.length, 0);
    assert.equal((await m.get("/contacts?q=carolina")).json.contatos.length, 1);
    assert.equal((await m.post("/contacts", { ...contactBody, request_key: crypto.randomUUID(), fazenda_ids: [2] })).status, 404);
    const dup = await m.post("/contacts", { ...contactBody, request_key: crypto.randomUUID() }); assert.equal(dup.status, 409); assert.equal(dup.json.duplicates[0].id, c.id);
    const confirmed = await m.post("/contacts", { ...contactBody, request_key: crypto.randomUUID(), confirmar_duplicado: true }); assert.equal(confirmed.status, 201);
    const updated = await m.put(`/contacts/${c.id}`, { ...contactBody, versao: c.versao, nome: "Carolina Souza" }); assert.equal(updated.status, 200);
    assert.equal((await m.put(`/contacts/${c.id}`, { ...contactBody, versao: c.versao })).status, 409);
    assert.equal((await m.put(`/contacts/${c.id}`, { ...contactBody, versao: updated.json.versao, responsavel_id: other.id })).status, 403);
    await admin.put(`/users/${other.id}/access`, { fazenda_ids: [1], contato_ids: [c.id] });
    assert.equal((await outsider.get(`/contacts/${c.id}`)).status, 200);
    counts.push("contatos, busca, duplicidade, persistência, concorrência e acesso por registro");
    const dealBody = { contato_id: c.id, fazenda_id: 1, etapa: "novo", proximo_retorno: "2027-01-02T13:00:00Z", observacoes: "Agendar visita", request_key: crypto.randomUUID() };
    const deal = await m.post("/deals", dealBody); assert.equal(deal.status, 201, deal.text);
    assert.equal((await m.post("/deals", dealBody)).json.id, deal.json.id);
    assert.equal((await m.put(`/deals/${deal.json.id}`, { ...dealBody, etapa: "visita_agendada", proximo_retorno: null, versao: 1 })).status, 200);
    assert.equal((await m.put(`/deals/${deal.json.id}`, { ...dealBody, versao: 1 })).status, 409);
    assert.equal((await m.get("/deals")).json.negociacoes[0].proximo_retorno, null);
    assert.ok((await m.get(`/contacts/${c.id}`)).json.historico.some((e: any) => e.acao === "Negociação atualizada"));
    const upload = (buf: Buffer, name: string, reqKey = crypto.randomUUID()) => {
      const form = new FormData(); form.append("categoria", "Matrícula"); form.append("descricao", "Documento de teste sintético"); form.append("request_key", reqKey);
      form.append("arquivo", new Blob([new Uint8Array(buf)]), name); return form;
    };
    const docKey = crypto.randomUUID();
    const doc = await m.post("/farms/1/documents", upload(PDF, "matricula.pdf", docKey)); assert.equal(doc.status, 201, doc.text);
    assert.equal((await m.post("/farms/1/documents", upload(PDF, "matricula.pdf", docKey))).json.id, doc.json.id);
    assert.equal((await m.get(`/documents/${doc.json.id}/download`)).status, 200);
    const download = await m.get(`/documents/${doc.json.id}/download`);
    assert.match(download.headers.get("content-disposition") || "", /attachment/); assert.match(download.headers.get("cache-control") || "", /no-store/);
    assert.equal((await anon.get(`/documents/${doc.json.id}/download`)).status, 401);
    await admin.put(`/users/${other.id}/access`, { fazenda_ids: [], contato_ids: [c.id] });
    assert.equal((await outsider.get(`/documents/${doc.json.id}/download`)).status, 404);
    assert.equal((await outsider.get("/deals")).json.negociacoes.length, 0);
    assert.equal((await m.post("/farms/1/documents", upload(Buffer.from("<script>bad</script>"), "fake.pdf"))).status, 415);
    assert.equal((await m.post("/farms/1/documents", upload(PDF, "test.html"))).status, 415);
    assert.equal((await m.post("/farms/1/documents", upload(Buffer.alloc(12 * 1024 * 1024 + 1), "grande.pdf"))).status, 413);
    const image = await m.post("/farms/1/documents", upload(PNG, "foto.png"));
    assert.equal(image.status, 201, image.text);
    assert.match((await m.get(`/documents/${image.json.id}/download`)).headers.get("content-type") || "", /image\/png/);
    await m.del(`/documents/${image.json.id}`);
    assert.throws(() => inspectDocument(Buffer.from("%PDF-1.4\n/Java#53cript\n%%EOF\n"), "a.pdf"));
    assert.throws(() => inspectDocument(Buffer.from("%PDF-1.4\n/ObjStm\n%%EOF\n"), "a.pdf"));
    assert.equal((await m.del(`/documents/${doc.json.id}`)).status, 200);
    assert.equal((await m.get(`/documents/${doc.json.id}/download`)).status, 404);
    counts.push("negociações, histórico, retornos e documentos privados/assinaturas de arquivo");
    const imported = await admin.post("/source/import", {}); assert.equal(imported.status, 200, imported.text); assert.equal(imported.json.importados, 2);
    assert.equal((await admin.post("/source/import", {})).json.importados, 0);
    assert.equal((await admin.post("/source/import", {})).json.existentes, 2);
    const farmBefore = (await admin.get("/farms")).json.fazendas;
    f.failSource(true); assert.equal((await admin.post("/source/refresh", {})).status, 503);
    assert.deepEqual((await admin.get("/farms")).json.fazendas, farmBefore);
    assert.equal((await admin.get("/farms")).json.fonte.erro, true);
    assert.equal((await admin.post("/source/import", {})).status, 503); f.failSource(false);
    assert.equal((await admin.post("/source/refresh", {})).status, 200);
    assert.equal((await admin.get("/farms")).json.fonte.erro, false);
    assert.equal(await f.sourceFingerprint(), before);
    await f.site.query("DELETE FROM fazendas WHERE id=2");
    assert.equal((await admin.post("/source/refresh", {})).status, 200);
    assert.equal((await admin.get("/farms/2")).json.fazenda.disponivel, false);
    // A integridade foi comparada antes da remoção intencional na fixture.
    counts.push("importação idempotente, origem indisponível preserva dados, anúncio removido mantém snapshot");
    const mRow = (await admin.get("/users")).json.usuarios.find((u: any) => u.id === member.id);
    assert.equal((await admin.put(`/users/${member.id}`, { bloqueado: true, versao: mRow.versao })).status, 200);
    assert.equal((await m.get("/contacts")).status, 401);
    const blockedRow = (await admin.get("/users")).json.usuarios.find((u: any) => u.id === member.id);
    await admin.put(`/users/${member.id}`, { bloqueado: false, senha: TEST_PASSWORD + "2", versao: blockedRow.versao });
    assert.equal((await m.post("/login", { email: member.email, senha: TEST_PASSWORD })).status, 401);
    assert.equal((await m.post("/login", { email: member.email, senha: TEST_PASSWORD + "2" })).status, 200);
    const session2 = f.client(); await session2.post("/login", { email: member.email, senha: TEST_PASSWORD + "2" });
    assert.equal((await m.put("/password", { atual: TEST_PASSWORD + "2", nova: TEST_PASSWORD + "3" })).status, 200);
    assert.equal((await session2.get("/contacts")).status, 401);
    assert.equal((await m.put("/password", { atual: TEST_PASSWORD + "3", nova: TEST_PASSWORD + "4 " })).status, 200);
    const withSpace = f.client();
    assert.equal((await withSpace.post("/login", { email: member.email, senha: TEST_PASSWORD + "4 " })).status, 200);
    assert.equal((await f.client().post("/login", { email: member.email, senha: TEST_PASSWORD + "4" })).status, 401);
    const current = (await m.get(`/contacts/${c.id}`)).json.contato;
    assert.equal((await m.del(`/contacts/${c.id}`, { versao: current.versao })).status, 200);
    assert.equal((await m.get(`/contacts/${c.id}`)).status, 404);
    assert.equal((await admin.put(`/users/${1}`, { bloqueado: true, versao: 1 })).status, 400);
    const allSourceReads = f.reads(); assert.ok(allSourceReads >= 5);
    assert.equal((await admin.post("/logout", {})).status, 200);
    assert.equal((await admin.get("/contacts")).status, 401);
    counts.push("bloqueio imediato, redefinição de senha, invalidação de sessões e exclusão");
    process.stdout.write(counts.map(c => "PASS " + c).join("\n") + "\n");
  } finally { await f.close(); }
  const clean = await fixture();
  try {
    const original = await clean.sourceFingerprint(), a = clean.client();
    const sql: string[] = []; let writable = false, released = 0;
    const origin = new PgSource({ connect: async () => ({
      query: async (query: string) => {
        sql.push(query);
        if (query.includes("has_table_privilege")) return { rows: [{ escrita: writable }] };
        return clean.site.query(query);
      }, release: () => { released++; },
    }) } as unknown as pg.Pool);
    const source = await origin.read();
    assert.equal(source.farms.length, 2); assert.equal(source.contacts.length, 1); assert.equal(source.presentations.length, 1);
    assert.ok(sql[0]?.includes("READ ONLY")); assert.ok(sql.every(s => /^(BEGIN|SELECT|COMMIT|ROLLBACK)/.test(s)));
    writable = true;
    await assert.rejects(() => origin.read(), /exclusivamente de leitura/);
    assert.equal(released, 2); assert.equal(sql.at(-1), "ROLLBACK");
    process.stdout.write("PASS adaptador PostgreSQL lê o esquema real, exige READ ONLY e recusa credencial de escrita\n");
    await a.post("/login", { email: "gestor@crm.test", senha: TEST_PASSWORD });
    await a.post("/source/import", {}); await a.post("/source/refresh", {});
    const c = (await a.post("/contacts", { nome: "Teste isolado", telefone: "34999993333", origem: "Telefone", observacoes: "", responsavel_id: 1, fazenda_ids: [1], request_key: crypto.randomUUID() })).json;
    await a.del(`/contacts/${c.id}`, { versao: 1 });
    assert.equal(await clean.sourceFingerprint(), original);
    process.stdout.write("PASS banco e arquivos públicos permanecem intactos após operações no CRM\n");
  } finally { await clean.close(); }
  const limited = await fixture(undefined, true);
  try {
    const r = await fetch(limited.base + "/crm/api/csrf"), token = (await r.json() as { token: string }).token;
    const cookie = (r.headers.get("set-cookie") || "").split(";")[0]!;
    const badOrigin = await fetch(limited.base + "/crm/api/login", {
      method: "POST", headers: { Cookie: cookie, "X-CSRF-Token": token, "Content-Type": "application/json", Origin: "https://outro.test" },
      body: JSON.stringify({ email: "naoexiste@crm.test", senha: "senha-incorreta" }),
    });
    assert.equal(badOrigin.status, 403);
    const client = limited.client();
    for (let i = 0; i <= 10; i++)
      assert.equal((await client.post("/login", { email: "naoexiste@crm.test", senha: "senha-incorreta" })).status, i < 10 ? 401 : 429);
    process.stdout.write("PASS origem cruzada recusada e tentativas de login limitadas sem revelar contas\n");
  } finally { await limited.close(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
