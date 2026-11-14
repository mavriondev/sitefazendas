import assert from "node:assert/strict";
import crypto from "node:crypto";
import { fixture, TEST_PASSWORD } from "./fixture";

export async function flowReview() {
  const f = await fixture();
  try {
    // Alteração intencional apenas na origem sintética para representar contato incompleto.
    await f.site.query("UPDATE contatos SET whatsapp='' WHERE id=1");
    const before = await f.sourceFingerprint();
    const a = f.client();
    assert.equal((await a.post("/login", { email: "gestor@crm.test", senha: TEST_PASSWORD })).status, 200);
    const addUser = async (email: string) => (await a.post("/users", { nome: "Equipe", email, senha: TEST_PASSWORD, request_key: crypto.randomUUID() })).json;
    const owner = await addUser("responsavel@crm.test"), member = await addUser("assistente@crm.test");
    const body = { nome: "Contato nacional", telefone: "(34) 9999-0101", email: null, origem: "Indicação", observacoes: "", responsavel_id: owner.id, fazenda_ids: [1], request_key: crypto.randomUUID() };
    let c = (await a.post("/contacts", body)).json;
    assert.equal(c.telefone, "553499990101");
    assert.equal((await a.get("/contacts/duplicates?telefone=%2B55%2034%209999-0101")).json.contatos[0].id, c.id);
    assert.equal((await a.get("/contacts?q="+encodeURIComponent("(34) 9999-0101"))).json.contatos[0].id, c.id);
    assert.equal((await a.post("/contacts", { ...body, telefone: "+55 34 9999-0101", request_key: crypto.randomUUID() })).status, 409);
    assert.equal((await a.post("/contacts", { ...body, telefone: "", request_key: crypto.randomUUID() })).status, 400);
    const legacy = await f.db.query(`INSERT INTO crm_contacts(nome,telefone,origem,responsavel_id,criado_por,request_key)
      VALUES('Anterior','3499990102','Manual',1,1,$1) RETURNING id`, [crypto.randomUUID()]);
    assert.equal((await a.get("/contacts/duplicates?telefone=553499990102")).json.contatos[0].id, legacy.rows[0].id);
    assert.equal((await a.post("/contacts", { ...body, telefone: "553499990102", request_key: crypto.randomUUID() })).status, 409);
    assert.equal((await f.db.query("SELECT telefone FROM crm_contacts WHERE id=$1", [legacy.rows[0].id])).rows[0].telefone, "3499990102");

    assert.equal((await a.post("/source/import", {})).status, 200);
    const imported = (await a.get("/contacts?q=Marina")).json.contatos[0];
    assert.equal(imported.telefone, "");
    assert.equal((await a.put(`/contacts/${imported.id}`, { ...imported, observacoes: "Aguardando telefone", responsavel_id: 1 })).status, 200);
    assert.equal((await a.put(`/contacts/${c.id}`, { ...c, telefone: "", versao: c.versao })).status, 400);

    assert.equal((await a.put(`/users/${owner.id}`, { bloqueado: true, versao: owner.versao })).status, 200);
    const edit = await a.put(`/contacts/${c.id}`, { ...c, observacoes: "Responsável bloqueado; histórico preservado" });
    assert.equal(edit.status, 200); c = edit.json;
    assert.equal((await a.post("/contacts", { ...body, telefone: "3499990103", request_key: crypto.randomUUID() })).status, 400);
    await a.put(`/users/${member.id}/access`, { fazenda_ids: [1], contato_ids: [c.id] });
    const m = f.client(); await m.post("/login", { email: member.email, senha: TEST_PASSWORD });
    const shared = await m.put(`/contacts/${c.id}`, { ...c, observacoes: "Atendimento compartilhado" });
    assert.equal(shared.status, 200); c = shared.json;
    const dealBody = { contato_id: c.id, fazenda_id: 1, etapa: "em_atendimento", proximo_retorno: "2027-02-01T15:00:00Z", observacoes: "Visita", request_key: crypto.randomUUID() };
    const d = (await a.post("/deals", dealBody)).json;
    const closed = await a.put(`/deals/${d.id}`, { ...dealBody, etapa: "concluida", versao: d.versao });
    assert.equal(closed.status, 200); assert.equal(closed.json.proximo_retorno, null);
    assert.equal((await a.post("/deals", { ...dealBody, request_key: crypto.randomUUID(), proximo_retorno: 0 })).status, 400);
    const hidden = (await a.post("/deals", { ...dealBody, fazenda_id: 2, request_key: crypto.randomUUID() })).json;
    assert.ok(hidden.id);
    assert.equal((await m.del(`/contacts/${c.id}`, { versao: c.versao })).status, 403);
    assert.equal((await a.get(`/contacts/${c.id}`)).status, 200);
    assert.ok((await a.get("/deals")).json.negociacoes.some((d: any) => d.id === hidden.id));
    assert.equal(await f.sourceFingerprint(), before);

    await f.site.query("DELETE FROM fazendas WHERE id=2");
    const removedSource = await f.sourceFingerprint();
    assert.equal((await a.post("/source/refresh", {})).status, 200);
    assert.equal((await a.post("/deals", { ...dealBody, fazenda_id: 2, request_key: crypto.randomUUID() })).status, 409);
    assert.equal((await a.put(`/deals/${hidden.id}`, { ...dealBody, fazenda_id: 2, etapa: "nao_avancou", versao: hidden.versao })).status, 200);
    assert.equal((await a.del(`/contacts/${c.id}`, { versao: c.versao })).status, 200);
    assert.equal(await f.sourceFingerprint(), removedSource);
    process.stdout.write("PASS revisão do fluxo: telefone nacional/internacional e busca formatada, importação incompleta, responsável bloqueado, exclusão protegida, encerramento e fazenda retirada\n");
  } finally { await f.close(); }
}
