import type { Express } from "express";
import type { Database } from "./db";
import { asyncRoute as route, who, admin, check, id, ids, text, email, password, hashPassword, comparePassword, publicUser, uuid, event, contactScope } from "./security";
export async function bootstrap(db: Database, e?: string, p?: string) {
  if ((await db.query("SELECT 1 FROM crm_users WHERE papel='admin'")).rowCount) return;
  if (!e || !p) return;
  await db.query("INSERT INTO crm_users(nome,email,senha_hash,papel) VALUES('Administrador',$1,$2,'admin') ON CONFLICT(email) DO NOTHING", [email(e), await hashPassword(password(p))]);
}
export function registerUsers(app: Express, db: Database) {
  app.get("/crm/api/users", route(async (req, res) => {
    const u = who(req);
    if (u.papel === "admin") res.json({ usuarios: (await db.query("SELECT * FROM crm_users ORDER BY nome,id")).rows.map(publicUser) });
    else {
      const r = await db.query(`SELECT DISTINCT r.id,r.nome FROM crm_users r LEFT JOIN crm_contacts c ON c.responsavel_id=r.id WHERE r.id=$1 OR ${contactScope(u)}`, [u.id]);
      res.json({ usuarios: r.rows.map(r => r.id === u.id ? u : { ...r, email: "", papel: "membro", bloqueado: false, versao: 0 }) });
    }
  }));
  app.post("/crm/api/users", route(async (req, res) => {
    admin(req); const b = req.body ?? {}, requestKey = uuid(b.request_key);
    const v = [text(b.nome, 150, true), email(b.email), await hashPassword(password(b.senha)), requestKey];
    const r = await db.transaction(async tx => {
      const old = await tx.query("SELECT * FROM crm_users WHERE request_key=$1", [requestKey]);
      if (old.rowCount) return old.rows[0];
      const row = (await tx.query("INSERT INTO crm_users(nome,email,senha_hash,papel,request_key) VALUES($1,$2,$3,'membro',$4) RETURNING *", v)).rows[0];
      await event(tx, who(req), "Membro cadastrado", { usuario_id: row.id }); return row;
    });
    res.status(201).json(publicUser(r));
  }));
  app.put("/crm/api/users/:id", route(async (req, res) => {
    admin(req); const uid = id(req.params.id), b = req.body ?? {};
    check(uid !== who(req).id, 400, "Use Minha conta para alterar sua senha. Você não pode bloquear a própria conta.");
    check(b.bloqueado !== undefined || b.senha !== undefined);
    if (b.bloqueado !== undefined) check(typeof b.bloqueado === "boolean");
    const hash = b.senha === undefined ? null : await hashPassword(password(b.senha));
    const row = await db.transaction(async tx => {
      const old = (await tx.query("SELECT * FROM crm_users WHERE id=$1 FOR UPDATE", [uid])).rows[0];
      check(old && old.papel === "membro", 404, "Membro não encontrado.");
      check(old.versao === id(b.versao), 409, "Conta alterada. Recarregue a página.");
      const r = await tx.query(`UPDATE crm_users SET bloqueado=$2,senha_hash=COALESCE($3,senha_hash),versao=versao+1,auth_version=auth_version+1 WHERE id=$1 RETURNING *`,
      [uid, b.bloqueado ?? old.bloqueado, hash]);
      await event(tx, who(req), hash ? "Senha do membro redefinida" : b.bloqueado ? "Membro bloqueado" : "Membro desbloqueado", { usuario_id: uid });
      return r.rows[0];
    }); res.json(publicUser(row));
  }));
  app.get("/crm/api/users/:id/access", route(async (req, res) => {
    admin(req); const uid = id(req.params.id);
    check((await db.query("SELECT 1 FROM crm_users WHERE id=$1", [uid])).rowCount, 404);
    res.json({ fazenda_ids: (await db.query("SELECT fazenda_id FROM crm_farm_access WHERE usuario_id=$1", [uid])).rows.map(r => r.fazenda_id),
      contato_ids: (await db.query("SELECT contato_id FROM crm_contact_access WHERE usuario_id=$1", [uid])).rows.map(r => r.contato_id) });
  }));
  app.put("/crm/api/users/:id/access", route(async (req, res) => {
    admin(req); const uid = id(req.params.id), fids = ids(req.body?.fazenda_ids), cids = ids(req.body?.contato_ids);
    await db.transaction(async tx => {
      check((await tx.query("SELECT 1 FROM crm_users WHERE id=$1 AND papel='membro' FOR UPDATE", [uid])).rowCount, 404, "Membro não encontrado.");
      check((await tx.query("SELECT id FROM crm_farms WHERE id=ANY($1::int[])", [fids])).rowCount === fids.length);
      check((await tx.query("SELECT id FROM crm_contacts WHERE id=ANY($1::int[])", [cids])).rowCount === cids.length);
      await tx.query("DELETE FROM crm_farm_access WHERE usuario_id=$1", [uid]); await tx.query("DELETE FROM crm_contact_access WHERE usuario_id=$1", [uid]);
      for (const fid of fids) await tx.query("INSERT INTO crm_farm_access(usuario_id,fazenda_id) VALUES($1,$2)", [uid, fid]);
      for (const cid of cids) await tx.query("INSERT INTO crm_contact_access(usuario_id,contato_id) VALUES($1,$2)", [uid, cid]);
      await event(tx, who(req), "Permissões atualizadas", { usuario_id: uid, fazendas: fids.length, contatos: cids.length });
    }); res.json({ ok: true });
  }));
  app.put("/crm/api/password", route(async (req, res) => {
    const u = who(req), b = req.body ?? {}, atual = b.atual, nova = password(b.nova);
    check(typeof atual === "string" && atual.length > 0 && Buffer.byteLength(atual) <= 200, 400, "Informe a senha atual.");
    const row = (await db.query("SELECT * FROM crm_users WHERE id=$1", [u.id])).rows[0];
    check(await comparePassword(atual, row.senha_hash), 400, "Senha atual incorreta.");
    check(atual !== nova, 400, "Escolha uma senha diferente.");
    const hash = await hashPassword(nova);
    const r = await db.query("UPDATE crm_users SET senha_hash=$2,auth_version=auth_version+1,versao=versao+1 WHERE id=$1 AND auth_version=$3 RETURNING auth_version", [u.id, hash, row.auth_version]);
    check(r.rowCount, 409, "Conta alterada. Entre novamente.");
    // Todas as outras sessões expiram; a sessão atual permanece válida.
    (req.session as any).crmAuthVersion = r.rows[0].auth_version;
    await event(db, u, "Senha alterada", {}); res.json({ ok: true });
  }));
}
