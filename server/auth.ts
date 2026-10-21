import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import type { Db } from "./db";

declare module "express-session" {
  interface SessionData { usuarioId?: number }
}

export interface Usuario {
  id: number; email: string; nome: string; whatsapp: string | null;
  papel: "comprador" | "admin"; nivel_acesso: "aberto" | "desbloqueado" | "completo"; bloqueado: boolean;
}

export const hashSenha = (senha: string) => bcrypt.hash(senha, 11);
export const confereSenha = (senha: string, hash: string) => bcrypt.compare(senha, hash);

export function validarEmail(e: unknown): string | null {
  if (typeof e !== "string") return null;
  const v = e.trim().toLowerCase();
  return v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
}
export function validarSenha(s: unknown): string | null {
  if (typeof s !== "string") return "Senha inválida.";
  if (s.length < 8) return "A senha precisa ter ao menos 8 caracteres.";
  if (s.length > 200) return "Senha muito longa.";
  return null;
}
export function limparTelefone(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const d = t.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export async function carregarUsuario(db: Db, id: number | undefined): Promise<Usuario | null> {
  if (!id) return null;
  const r = await db.query<Usuario>(
    "SELECT id, email, nome, whatsapp, papel, nivel_acesso, bloqueado FROM usuarios WHERE id = $1",
    [id],
  );
  const u = r.rows[0];
  return u && !u.bloqueado ? u : null; // bloqueio vale na hora, mesmo com sessão aberta
}

export function middlewaresDeAuth(db: Db) {
  const anexar = async (req: Request, _res: Response, next: NextFunction) => {
    try { (req as any).usuario = await carregarUsuario(db, req.session?.usuarioId); } catch (e) { return next(e); }
    next();
  };
  const exigirLogin = (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).usuario) return res.status(401).json({ message: "Faça login." });
    next();
  };
  const exigirAdmin = (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).usuario as Usuario | null;
    if (!u) return res.status(401).json({ message: "Faça login." });
    if (u.papel !== "admin") return res.status(403).json({ message: "Acesso restrito." });
    next();
  };
  return { anexar, exigirLogin, exigirAdmin };
}

/** Cria o primeiro admin a partir de ADMIN_EMAIL / ADMIN_PASSWORD, se ainda não existir nenhum. */
export async function garantirAdmin(db: Db, email?: string, senha?: string): Promise<"criado" | "existe" | "ignorado"> {
  const ex = await db.query("SELECT 1 FROM usuarios WHERE papel = 'admin' LIMIT 1");
  if (ex.rowCount > 0) return "existe";
  const e = validarEmail(email);
  if (!e || validarSenha(senha)) return "ignorado";
  await db.query(
    "INSERT INTO usuarios (email, senha_hash, nome, papel, nivel_acesso, aceite_lgpd_em) VALUES ($1,$2,'Administrador','admin','completo', now())",
    [e, await hashSenha(senha as string)],
  );
  return "criado";
}
