import assert from "node:assert/strict";
import { subirApp } from "./helpers";
import { validarSenha } from "../auth";
import { retornoSeguro } from "../../shared/navegacao";

export async function rodar() {
  assert.ok(validarSenha("senha-curta"));
  assert.equal(validarSenha("frase de senha longa"), null);
  assert.ok(validarSenha("á".repeat(37))); // bcrypt não deve truncar bytes.
  for (const destino of ["//evil.test", "/\\evil.test", "/%5cevil.test", "/%255cevil.test", "/a/..//evil.test", "https://evil.test", "/\tevil.test"]) {
    assert.equal(retornoSeguro(destino), "/", destino);
  }
  assert.equal(retornoSeguro("/fazendas?regiao=Minas"), "/fazendas?regiao=Minas");

  const t = await subirApp();
  try {
    const sessao = async () => {
      const r = await fetch(t.base + "/api/auth/csrf");
      assert.equal(r.headers.get("cache-control"), "no-store");
      const cookie = r.headers.get("set-cookie")!;
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
      return { cookie: cookie.split(";")[0], token: (await r.json()).token };
    };
    const s = await sessao();
    const contato = { nome: "Pessoa teste", whatsapp: "31999990000", mensagem: "Olá" };
    const raw = (body: string, headers: Record<string, string> = {}, rota = "/api/public/contato") => fetch(t.base + rota, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, "x-csrf-token": s.token, ...headers },
      body,
    });
    // Sem token, token de outra sessão e origem externa não podem enviar.
    assert.equal((await raw(JSON.stringify(contato), { "x-csrf-token": "" })).status, 403);
    const outra = await sessao();
    assert.equal((await raw(JSON.stringify(contato), { "x-csrf-token": outra.token })).status, 403);
    assert.equal((await raw(JSON.stringify(contato), { origin: "https://evil.test" })).status, 403);
    assert.equal((await raw(JSON.stringify(contato), { "sec-fetch-site": "cross-site" })).status, 403);
    assert.equal((await raw(JSON.stringify(contato), { origin: t.base })).status, 201);
    // JSON, tamanho, tipos, controles e prototype pollution.
    assert.equal((await raw("{")).status, 400);
    assert.equal((await raw("[]")).status, 400);
    assert.equal((await raw('{"__proto__":{"admin":true}}')).status, 400);
    assert.equal((await raw('{"constructor":{"prototype":{"admin":true}}}')).status, 400);
    assert.equal((await raw(JSON.stringify({ ...contato, mensagem: "x".repeat(20000) }))).status, 413);
    for (const invalido of [
      { ...contato, nome: { admin: true } }, { ...contato, whatsapp: ["31999990000"] },
      { ...contato, mensagem: "x".repeat(1001) }, { ...contato, nome: "a".repeat(121) },
      { ...contato, mensagem: "oi\u0000" }, { ...contato, papel: "admin" },
    ]) assert.equal((await raw(JSON.stringify(invalido))).status, 400);
    assert.equal((await t.admin.get("/api/admin/fazendas/NaN")).status, 400);
    assert.equal((await t.admin.get("/api/admin/fazendas/2147483648")).status, 400);
    assert.equal((await t.cliente().get("/api/admin/contatos")).status, 401);

    // Uma falha assíncrona de banco não encerra o processo nem vaza SQL.
    const query = t.db.query.bind(t.db);
    t.db.query = async () => { throw new Error("SQL e segredo que não podem sair"); };
    const erro = await fetch(t.base + "/api/public/filtros");
    assert.equal(erro.status, 500);
    assert.deepEqual(await erro.json(), { message: "Erro interno." });
    t.db.query = query;
    assert.equal((await fetch(t.base + "/api/saude")).status, 200);

    // Sessão antiga revogada em troca e redefinição; sessão atual segue funcionando.
    const a = t.cliente(), b = t.cliente();
    const cadastro = { nome: "Teste segurança", email: "seguranca@teste.com", whatsapp: "31999990001", senha: "senha-de-teste-123", aceite: true };
    assert.equal((await a.post("/api/auth/registrar", cadastro)).status, 201);
    assert.equal((await b.post("/api/auth/entrar", cadastro)).status, 200);
    assert.equal((await a.put("/api/auth/senha", { senha_atual: cadastro.senha, senha_nova: "nova-senha-teste-456" })).status, 200);
    assert.equal((await a.get("/api/auth/eu")).json.usuario.email, cadastro.email);
    assert.equal((await b.get("/api/auth/eu")).json.usuario, null);
    assert.equal((await b.post("/api/auth/entrar", { email: cadastro.email, senha: "nova-senha-teste-456" })).status, 200);
    const id = (await t.db.query("SELECT id FROM usuarios WHERE email=$1", [cadastro.email])).rows[0].id;
    const link = await t.admin.post(`/api/admin/usuarios/${id}/link-senha`);
    const token = link.json.caminho.split("token=")[1];
    const resets = await Promise.all([
      t.cliente().post("/api/auth/redefinir", { token, senha: "terceira-senha-teste-789" }),
      t.cliente().post("/api/auth/redefinir", { token, senha: "quarta-senha-teste-789" }),
    ]);
    assert.deepEqual(resets.map(x => x.status).sort(), [200, 400]);
    assert.equal((await a.get("/api/auth/eu")).json.usuario, null);
    assert.equal((await b.get("/api/auth/eu")).json.usuario, null);
    assert.equal((await t.admin.post("/api/auth/sair")).status, 200);
    assert.equal((await t.admin.get("/api/admin/contatos")).status, 401);
    const saude = await fetch(t.base + "/api/saude");
    assert.equal(saude.headers.get("x-content-type-options"), "nosniff");
    assert.match(saude.headers.get("content-security-policy")!, /script-src 'self'/);
    assert.equal(saude.headers.get("x-powered-by"), null);
  } finally { await t.fechar(); }

  const limitado = await subirApp({ limitar: true });
  try {
    const anon = limitado.cliente();
    for (let i = 0; i < 10; i++) assert.equal((await anon.post("/api/public/contato", { nome: "Robô", website: "spam" })).status, 200);
    assert.equal((await anon.post("/api/public/contato", { nome: "Robô", website: "spam" })).status, 429);
    for (let i = 0; i < 19; i++) assert.equal((await anon.post("/api/auth/entrar", { email: "invalido", senha: "x" })).status, 401);
    assert.equal((await anon.post("/api/auth/entrar", { email: "invalido", senha: "x" })).status, 429);
  } finally { await limitado.fechar(); }
}
