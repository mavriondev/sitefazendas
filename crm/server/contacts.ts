import type { Express } from "express";
import type { Database, Query } from "./db";
import type { User } from "../shared";
import { ETAPAS } from "../shared";
import { asyncRoute as route, who, check, text, id, ids, uuid, email, phone, canContact, canFarm, contactScope, farmScope, event, Fault } from "./security";
export async function contacts(db: Query, u: User, contactId?: number, q = "") {
  return (await db.query(`SELECT c.id,c.nome,c.telefone,c.email,c.origem,c.observacoes,c.responsavel_id,c.versao,c.criado_em,
    r.nome AS responsavel_nome,COALESCE((SELECT json_agg(cf.fazenda_id) FROM crm_contact_farms cf JOIN crm_farms f ON f.id=cf.fazenda_id
    WHERE cf.contato_id=c.id AND ${farmScope(u)}),'[]') AS fazenda_ids
    FROM crm_contacts c JOIN crm_users r ON r.id=c.responsavel_id
    WHERE ${contactScope(u)} AND ($1::int IS NULL OR c.id=$1) AND ($2='' OR c.nome ILIKE '%'||$2||'%' OR c.telefone LIKE '%'||$2||'%' OR c.email ILIKE '%'||$2||'%')
    ORDER BY c.criado_em DESC,c.id DESC`, [contactId ?? null, q])).rows;
}
export async function deals(db: Query, u: User, filter?: { contact?: number; farm?: number; deal?: number }) {
  return (await db.query(`SELECT d.*,c.nome AS contato_nome,f.snapshot->>'titulo' AS fazenda_titulo FROM crm_deals d
    JOIN crm_contacts c ON c.id=d.contato_id JOIN crm_farms f ON f.id=d.fazenda_id
    WHERE ${contactScope(u)} AND ${farmScope(u)} AND ($1::int IS NULL OR d.contato_id=$1) AND ($2::int IS NULL OR d.fazenda_id=$2)
    AND ($3::int IS NULL OR d.id=$3) ORDER BY d.atualizado_em DESC,d.id DESC`,
  [filter?.contact ?? null, filter?.farm ?? null, filter?.deal ?? null])).rows;
}
export async function history(db: Query, u: User, filter: { contact?: number; farm?: number }) {
  return (await db.query(`SELECT e.id,e.acao,e.detalhes,e.criado_em,u.nome AS autor_nome FROM crm_events e JOIN crm_users u ON u.id=e.autor_id
    WHERE ($1::int IS NULL OR e.contato_id=$1) AND ($2::int IS NULL OR e.fazenda_id=$2)
    AND (e.contato_id IS NULL OR EXISTS(SELECT 1 FROM crm_contacts c WHERE c.id=e.contato_id AND ${contactScope(u)}))
    AND (e.fazenda_id IS NULL OR EXISTS(SELECT 1 FROM crm_farms f WHERE f.id=e.fazenda_id AND ${farmScope(u)}))
    ORDER BY e.criado_em DESC,e.id DESC LIMIT 200`, [filter.contact ?? null, filter.farm ?? null])).rows;
}
export function registerContacts(app: Express, db: Database) {
  app.get("/crm/api/contacts", route(async (req, res) => {
    res.json({ contatos: await contacts(db, who(req), undefined, text(req.query.q ?? "", 100)) });
  }));
  app.get("/crm/api/contacts/duplicates", route(async (req, res) => {
    const tel = phone(req.query.telefone); const exclude = req.query.exclude ? id(req.query.exclude) : null;
    res.json({ contatos: (await db.query(`SELECT c.id,c.nome FROM crm_contacts c WHERE telefone=$1 AND ($2::int IS NULL OR id<>$2) AND ${contactScope(who(req))}`, [tel, exclude])).rows });
  }));
  app.get("/crm/api/contacts/:id", route(async (req, res) => {
    const cid = id(req.params.id), u = who(req); await canContact(db, u, cid);
    res.json({ contato: (await contacts(db, u, cid))[0], negociacoes: await deals(db, u, { contact: cid }), historico: await history(db, u, { contact: cid }) });
  }));
  const save = (editing: boolean) => route(async (req, res) => {
    const u = who(req), b = req.body ?? {}, cid = editing ? id(req.params.id) : null, requestKey = editing ? null : uuid(b.request_key);
    const v = { nome: text(b.nome, 150, true), telefone: phone(b.telefone), email: b.email ? email(b.email) : null,
      origem: text(b.origem, 100, true), observacoes: text(b.observacoes ?? "", 4000), responsavel: id(b.responsavel_id), farms: ids(b.fazenda_ids) };
    const result = await db.transaction(async tx => {
      if (cid) await canContact(tx, u, cid);
      else {
        const existing = await tx.query("SELECT id FROM crm_contacts WHERE criado_por=$1 AND request_key=$2", [u.id, requestKey]);
        if (existing.rowCount) return (await contacts(tx, u, existing.rows[0].id))[0];
      }
      const old = cid ? (await tx.query("SELECT * FROM crm_contacts WHERE id=$1 FOR UPDATE", [cid])).rows[0] : null;
      check(u.papel === "admin" || v.responsavel === (old?.responsavel_id ?? u.id), 403, "Somente o administrador pode mudar o responsável.");
      check((await tx.query("SELECT 1 FROM crm_users WHERE id=$1 AND NOT bloqueado", [v.responsavel])).rowCount, 400, "Responsável indisponível.");
      for (const fid of v.farms) await canFarm(tx, u, fid);
      const dup = await tx.query("SELECT id,nome FROM crm_contacts WHERE telefone=$1 AND ($2::int IS NULL OR id<>$2)", [v.telefone, cid]);
      if (dup.rowCount && (!old || old.telefone !== v.telefone) && b.confirmar_duplicado !== true) {
        // Não revela identidade de contatos que o membro não pode acessar.
        const visible = await tx.query(`SELECT c.id,c.nome FROM crm_contacts c WHERE telefone=$1 AND ($2::int IS NULL OR id<>$2) AND ${contactScope(u)}`, [v.telefone, cid]);
        throw new Fault(409, "Já existe um contato com este telefone. Confirme se deseja manter um cadastro separado.", { duplicates: visible.rows });
      }
      let contactId: number;
      if (cid) {
        check(old.versao === id(b.versao), 409, "Este contato foi alterado. Recarregue antes de salvar.");
        await tx.query(`UPDATE crm_contacts SET nome=$2,telefone=$3,email=$4,origem=$5,observacoes=$6,responsavel_id=$7,versao=versao+1 WHERE id=$1`,
        [cid, v.nome, v.telefone, v.email, v.origem, v.observacoes, v.responsavel]);
        contactId = cid;
      } else {
        const r = await tx.query(`INSERT INTO crm_contacts(nome,telefone,email,origem,observacoes,responsavel_id,criado_por,request_key)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(criado_por,request_key) DO NOTHING RETURNING id`,
        [v.nome, v.telefone, v.email, v.origem, v.observacoes, v.responsavel, u.id, requestKey]);
        if (!r.rowCount) {
          const repeated = (await tx.query("SELECT id FROM crm_contacts WHERE criado_por=$1 AND request_key=$2", [u.id, requestKey])).rows[0];
          return (await contacts(tx, u, repeated.id))[0];
        }
        contactId = r.rows[0].id;
      }
      await tx.query(`DELETE FROM crm_contact_farms cf WHERE contato_id=$1 AND EXISTS(SELECT 1 FROM crm_farms f WHERE f.id=cf.fazenda_id AND ${farmScope(u)})`, [contactId]);
      for (const fid of v.farms) await tx.query("INSERT INTO crm_contact_farms(contato_id,fazenda_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [contactId, fid]);
      await event(tx, u, cid ? "Contato atualizado" : "Contato cadastrado", { responsavel_id: v.responsavel }, contactId);
      return (await contacts(tx, u, contactId))[0];
    });
    res.status(editing ? 200 : 201).json(result);
  });
  app.post("/crm/api/contacts", save(false)); app.put("/crm/api/contacts/:id", save(true));
  app.delete("/crm/api/contacts/:id", route(async (req, res) => {
    const cid = id(req.params.id), u = who(req);
    await db.transaction(async tx => {
      await canContact(tx, u, cid);
      const r = await tx.query("DELETE FROM crm_contacts WHERE id=$1 AND versao=$2 RETURNING id", [cid, id(req.body?.versao)]);
      check(r.rowCount, 409, "Contato alterado. Recarregue a página.");
      // Histórico mínimo sem dados pessoais permanece para auditoria.
      await tx.query("UPDATE crm_events SET detalhes='{}',contato_id=NULL WHERE contato_id=$1", [cid]);
      await event(tx, u, "Contato excluído", { identificador: cid });
    }); res.json({ ok: true });
  }));
  app.get("/crm/api/deals", route(async (req, res) => res.json({ negociacoes: await deals(db, who(req)) })));
  const saveDeal = (editing: boolean) => route(async (req, res) => {
    const u = who(req), b = req.body ?? {}, did = editing ? id(req.params.id) : null;
    const cid = id(b.contato_id), fid = id(b.fazenda_id), requestKey = editing ? null : uuid(b.request_key);
    check(ETAPAS.includes(b.etapa), 400, "Etapa inválida.");
    const obs = text(b.observacoes ?? "", 4000);
    let when: string | null = null;
    if (b.proximo_retorno) { check(typeof b.proximo_retorno === "string" && !Number.isNaN(Date.parse(b.proximo_retorno)), 400, "Data inválida."); when = new Date(b.proximo_retorno).toISOString(); }
    const result = await db.transaction(async tx => {
      await canContact(tx, u, cid); await canFarm(tx, u, fid);
      let dealId: number;
      if (did) {
        const old = (await tx.query("SELECT * FROM crm_deals WHERE id=$1 FOR UPDATE", [did])).rows[0];
        check(old && old.contato_id === cid && old.fazenda_id === fid, 404, "Negociação não encontrada.");
        check(old.versao === id(b.versao), 409, "Negociação alterada. Recarregue antes de salvar.");
        await tx.query("UPDATE crm_deals SET etapa=$2,proximo_retorno=$3,observacoes=$4,versao=versao+1,atualizado_em=now() WHERE id=$1", [did, b.etapa, when, obs]);
        dealId = did;
      } else {
        const r = await tx.query(`INSERT INTO crm_deals(contato_id,fazenda_id,etapa,proximo_retorno,observacoes,criado_por,request_key)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(criado_por,request_key) DO NOTHING RETURNING id`, [cid, fid, b.etapa, when, obs, u.id, requestKey]);
        if (!r.rowCount) return (await deals(tx, u, { deal: (await tx.query("SELECT id FROM crm_deals WHERE criado_por=$1 AND request_key=$2", [u.id, requestKey])).rows[0].id }))[0];
        dealId = r.rows[0].id;
      }
      await tx.query("INSERT INTO crm_contact_farms(contato_id,fazenda_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [cid, fid]);
      await event(tx, u, did ? "Negociação atualizada" : "Negociação criada", { etapa: b.etapa, proximo_retorno: when, observacoes: obs }, cid, fid);
      return (await deals(tx, u, { deal: dealId }))[0];
    });
    res.status(editing ? 200 : 201).json(result);
  });
  app.post("/crm/api/deals", saveDeal(false)); app.put("/crm/api/deals/:id", saveDeal(true));
}
