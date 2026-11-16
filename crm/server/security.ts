import { normalizePhone } from "../shared";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import type { Query } from "./db";
import type { User } from "../shared";
export class Fault extends Error { constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); } }
export function check(ok: unknown, status = 400, message = "Confira os campos informados."): asserts ok { if (!ok) throw new Fault(status, message); }
export function text(v: unknown, max: number, required = false): string {
  check(typeof v === "string" && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v));
  const t = v.trim(); check(!required || t.length > 0); return t;
}
export function id(v: unknown) { const n = Number(v); check(Number.isSafeInteger(n) && n > 0); return n; }
export function ids(v: unknown): number[] { check(Array.isArray(v) && v.length <= 1000); return [...new Set(v.map(id))]; }
export function uuid(v: unknown) { check(typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)); return v; }
export function email(v: unknown) { const e = text(v, 200, true).toLowerCase(); check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), 400, "E-mail inválido."); return e; }
export function phone(v: unknown, optional = false) {
  const t = text(v, 40).replace(/\D/g, ""); check((optional && !t) || (t.length >= 10 && t.length <= 15), 400, "Informe o telefone com DDD."); return normalizePhone(t);
}
export function password(v: unknown) { check(typeof v === "string" && v.length >= 12 && Buffer.byteLength(v) <= 72, 400, "A senha precisa ter ao menos 12 caracteres e até 72 bytes."); return v; }
export const hashPassword = (s: string) => bcrypt.hash(s, 12);
export const comparePassword = (s: string, hash: string) => bcrypt.compare(s, hash);
export const publicUser = (u: any): User => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, bloqueado: u.bloqueado, versao: u.versao });
export const who = (req: Request): User => (req as any).crmUser;
export const admin = (req: Request, _res?: Response, next?: NextFunction) => { check(who(req)?.papel === "admin", 403, "Acesso restrito ao administrador do CRM."); next?.(); };
export const contactScope = (u: User, alias = "c") => u.papel === "admin" ? "TRUE" : `(${alias}.responsavel_id=${u.id} OR EXISTS(SELECT 1 FROM crm_contact_access ca WHERE ca.contato_id=${alias}.id AND ca.usuario_id=${u.id}))`;
export const farmScope = (u: User, alias = "f") => u.papel === "admin" ? "TRUE" : `EXISTS(SELECT 1 FROM crm_farm_access fa WHERE fa.fazenda_id=${alias}.id AND fa.usuario_id=${u.id})`;
export async function canFarm(db: Query, u: User, farmId: number) {
  check((await db.query(`SELECT 1 FROM crm_farms f WHERE f.id=$1 AND ${farmScope(u)}`, [farmId])).rowCount > 0, 404, "Fazenda não encontrada ou sem acesso.");
}
export async function canContact(db: Query, u: User, contactId: number) {
  check((await db.query(`SELECT 1 FROM crm_contacts c WHERE c.id=$1 AND ${contactScope(u)}`, [contactId])).rowCount > 0, 404, "Contato não encontrado ou sem acesso.");
}
export async function event(db: Query, user: User, acao: string, detalhes: Record<string, unknown>, contatoId?: number | null, farmId?: number | null) {
  await db.query("INSERT INTO crm_events(autor_id,acao,detalhes,contato_id,fazenda_id) VALUES($1,$2,$3::jsonb,$4,$5)", [user.id, acao, JSON.stringify(detalhes), contatoId ?? null, farmId ?? null]);
}
export function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
}
export function csrf(req: Request, res: Response, next: NextFunction) {
  const s = req.session as any;
  if (!s.csrf) s.csrf = crypto.randomBytes(32).toString("hex");
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) { next(); return; }
  const got = req.headers["x-csrf-token"];
  const origin = req.headers.origin;
  const originOk = !origin || (() => { try { return new URL(origin).host === req.get("host"); } catch { return false; } })();
  if (!originOk || req.headers["sec-fetch-site"] === "cross-site" || typeof got !== "string" || got.length !== s.csrf.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(s.csrf))) {
    res.status(403).json({ message: "Sessão de segurança expirada. Atualize a página." }); return;
  }
  next();
}
