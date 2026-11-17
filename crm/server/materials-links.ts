import crypto from "node:crypto";
import type { MaterialShare } from "../materials-shared";
import type { User } from "../shared";
import { canFarm, check, publicUser, uuid } from "./security";
import { materialKeys, openSelection, closeSelection, type MaterialContext } from "./materials-catalog";
import { limitsOf } from "./materials-storage";

export const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export function shareDto(s: any, user: User): MaterialShare {
  return { id: s.id, created_at: s.criado_em, expires_at: s.expira_em, revoked_at: s.revogado_em,
    item_count: s.items.length, can_revoke: user.papel === "admin" || s.criado_por === user.id };
}
export async function createLink(o: MaterialContext, secret: string, fid: number, user: User, input: any) {
  await canFarm(o.db, user, fid);
  check((await o.db.query("SELECT disponivel FROM crm_farms WHERE id=$1", [fid])).rows[0]?.disponivel, 409, "Esta fazenda não está mais disponível na origem.");
  const keys = materialKeys(input?.keys);
  check(input?.reviewed === true, 400, "Revise os arquivos e autorize a liberação externa.");
  check(Number.isInteger(input?.days) && input.days >= 1 && input.days <= 30, 400, "Escolha validade de 1 a 30 dias.");
  const requestKey = uuid(input?.request_key);
  const fingerprint = tokenHash(JSON.stringify({ fid, keys, days: input.days }));
  const token = crypto.createHmac("sha256", secret).update(`crm-materials:${user.id}:${fid}:${requestKey}`).digest("hex");
  const old = (await o.db.query("SELECT * FROM crm_material_shares WHERE criado_por=$1 AND request_key=$2", [user.id, requestKey])).rows[0];
  if (old) {
    check(old.request_hash === fingerprint && !old.revogado_em && Date.parse(old.expira_em) > Date.now(), 409, "Esta solicitação mudou ou o link foi encerrado. Gere um novo link.");
    return { link: shareDto(old,user), path: `/crm/compartilhar#${token}` };
  }
  const files = await openSelection(o, fid, keys);
  try {check(files.reduce((sum,f)=>sum+f.size,0)<=limitsOf(o).zip_bytes,413,"Os arquivos ultrapassam o limite por link. Divida a seleção em mais de um link.");}
  finally {await closeSelection(files);}
  const row = await o.db.transaction(async tx => {
    const owner = (await tx.query("SELECT auth_version FROM crm_users WHERE id=$1", [user.id])).rows[0];
    const r = await tx.query(`INSERT INTO crm_material_shares(fazenda_id,items,token_hash,request_key,request_hash,criado_por,owner_auth_version,expira_em)
      VALUES($1,$2::jsonb,$3,$4,$5,$6,$7,$8) ON CONFLICT(criado_por,request_key) DO NOTHING RETURNING *`,
      [fid,JSON.stringify(keys),tokenHash(token),requestKey,fingerprint,user.id,owner.auth_version,new Date(Date.now()+input.days*86400000).toISOString()]);
    const s = r.rows[0] ?? (await tx.query("SELECT * FROM crm_material_shares WHERE criado_por=$1 AND request_key=$2", [user.id,requestKey])).rows[0];
    check(s.request_hash === fingerprint && !s.revogado_em, 409, "A solicitação já foi usada com outra seleção.");
    return s;
  });
  return { link: shareDto(row,user), path: `/crm/compartilhar#${token}` };
}
export async function validateLink(o: MaterialContext, token: unknown) {
  const message = "Link expirado, cancelado ou indisponível. Peça um novo link ao responsável.";
  check(typeof token === "string" && /^[a-f0-9]{64}$/.test(token), 404, message);
  const s = (await o.db.query(`SELECT * FROM crm_material_shares WHERE token_hash=$1 AND revogado_em IS NULL AND expira_em>now()`, [tokenHash(token)])).rows[0];
  check(s,404,message);
  const u = (await o.db.query("SELECT * FROM crm_users WHERE id=$1", [s.criado_por])).rows[0];
  check(u && !u.bloqueado && u.auth_version === s.owner_auth_version,404,message);
  try { await canFarm(o.db,publicUser(u),s.fazenda_id); } catch { check(false,404,message); }
  check((await o.db.query("SELECT disponivel FROM crm_farms WHERE id=$1", [s.fazenda_id])).rows[0]?.disponivel,404,message);
  return s;
}
