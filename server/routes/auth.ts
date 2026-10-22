import type { Express } from "express";
import rateLimit from "express-rate-limit";
import type { Db } from "../db";
import crypto from "node:crypto";
import { confereSenha, hashSenha, limparTelefone, validarEmail, validarSenha } from "../auth";

export function registrarRotasAuth(app: Express, db: Db, opts: { limitar: boolean }) {
  const limite = opts.limitar
    ? rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: "Muitas tentativas. Aguarde alguns minutos." } })
    : (_req: any, _res: any, next: any) => next();

  app.post("/api/auth/registrar", limite, async (req, res) => {
    const { nome, email, senha, whatsapp, aceite } = req.body ?? {};
    const e = validarEmail(email);
    const erroSenha = validarSenha(senha);
    const tel = limparTelefone(whatsapp);
    if (typeof nome !== "string" || nome.trim().length < 2 || nome.length > 120) return res.status(400).json({ message: "Informe seu nome." });
    if (!e) return res.status(400).json({ message: "E-mail inválido." });
    if (erroSenha) return res.status(400).json({ message: erroSenha });
    if (!tel) return res.status(400).json({ message: "Informe um WhatsApp válido com DDD." });
    if (aceite !== true) return res.status(400).json({ message: "É preciso aceitar a política de privacidade." });
    try {
      const r = await db.query<{ id: number }>(
        `INSERT INTO usuarios (email, senha_hash, nome, whatsapp, aceite_lgpd_em) VALUES ($1,$2,$3,$4, now()) RETURNING id`,
        [e, await hashSenha(senha), nome.trim(), tel],
      );
      req.session.usuarioId = r.rows[0].id;
      res.status(201).json({ ok: true });
    } catch (err: any) {
      if (String(err?.code) === "23505" || /unique|duplicate/i.test(String(err?.message))) {
        return res.status(409).json({ message: "Este e-mail já está cadastrado." });
      }
      res.status(500).json({ message: "Erro ao cadastrar." });
    }
  });

  app.post("/api/auth/entrar", limite, async (req, res) => {
    const e = validarEmail(req.body?.email);
    const senha = req.body?.senha;
    // Mesma resposta para e-mail inexistente e senha errada (não revela quem tem cadastro).
    const falha = () => res.status(401).json({ message: "E-mail ou senha incorretos." });
    if (!e || typeof senha !== "string") return falha();
    const r = await db.query<{ id: number; senha_hash: string; bloqueado: boolean }>("SELECT id, senha_hash, bloqueado FROM usuarios WHERE email = $1", [e]);
    const u = r.rows[0];
    if (!u) { await hashSenha(senha); return falha(); }
    if (!(await confereSenha(senha, u.senha_hash)) || u.bloqueado) return falha();
    await new Promise<void>((ok, ko) => req.session.regenerate((err) => (err ? ko(err) : ok()))); // evita fixação de sessão
    req.session.usuarioId = u.id;
    await db.query("UPDATE usuarios SET ultimo_login_em = now() WHERE id = $1", [u.id]);
    res.json({ ok: true });
  });


  // Trocar a própria senha (logado).
  app.put("/api/auth/senha", limite, async (req, res) => {
    const u = (req as any).usuario;
    if (!u) return res.status(401).json({ message: "Faça login." });
    const { senha_atual, senha_nova } = req.body ?? {};
    const r = await db.query<{ senha_hash: string }>("SELECT senha_hash FROM usuarios WHERE id = $1", [u.id]);
    if (typeof senha_atual !== "string" || !(await confereSenha(senha_atual, r.rows[0].senha_hash))) return res.status(400).json({ message: "Senha atual incorreta." });
    const erro = validarSenha(senha_nova);
    if (erro) return res.status(400).json({ message: erro });
    await db.query("UPDATE usuarios SET senha_hash = $2, reset_hash = NULL, reset_expira = NULL WHERE id = $1", [u.id, await hashSenha(senha_nova)]);
    res.json({ ok: true });
  });

  // Redefinir com o link de uso único gerado pelo admin (sem e-mail; o link vai por WhatsApp).
  app.post("/api/auth/redefinir", limite, async (req, res) => {
    const { token, senha } = req.body ?? {};
    const invalido = () => res.status(400).json({ message: "Link inválido ou expirado. Peça um novo ao corretor." });
    if (typeof token !== "string" || token.length < 20 || token.length > 200) return invalido();
    const erro = validarSenha(senha);
    if (erro) return res.status(400).json({ message: erro });
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const r = await db.query<{ id: number }>("SELECT id FROM usuarios WHERE reset_hash = $1 AND reset_expira > now() AND NOT bloqueado", [hash]);
    if (!r.rows[0]) return invalido();
    await db.query("UPDATE usuarios SET senha_hash = $2, reset_hash = NULL, reset_expira = NULL WHERE id = $1", [r.rows[0].id, await hashSenha(senha)]);
    res.json({ ok: true });
  });

  app.post("/api/auth/sair", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/eu", (req, res) => {
    const u = (req as any).usuario;
    res.json({ usuario: u ? { nome: u.nome, email: u.email, papel: u.papel, nivel_acesso: u.nivel_acesso } : null });
  });
}
