import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";

const MUTACOES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Fachada de registro: Express 4 não encaminha rejeições de handlers async. */
export function rotasSeguras(app: Express): Express {
  const metodos = new Set(["get", "post", "put", "patch", "delete"]);
  return new Proxy(app, {
    get(alvo, prop) {
      if (typeof prop !== "string" || !metodos.has(prop)) return Reflect.get(alvo, prop);
      return (caminho: string, ...handlers: RequestHandler[]) => {
        const seguros = handlers.map((handler): RequestHandler => (req, res, next) => {
          try { Promise.resolve(handler(req, res, next)).catch(next); }
          catch (erro) { next(erro); }
        });
        return (alvo[prop as "post"] as Function).call(alvo, caminho, ...seguros);
      };
    },
  });
}

declare module "express-session" {
  interface SessionData { csrf?: string; senhaMarca?: string }
}

export const marcaSenha = (hash: string) => crypto.createHash("sha256").update(hash).digest("hex");

/** Token vinculado à sessão, inclusive antes do login. Não é colocado em URLs. */
export function instalarCsrf(app: Express) {
  app.get("/api/auth/csrf", (req, res, next) => {
    req.session.csrf ??= crypto.randomBytes(32).toString("hex");
    req.session.save((erro) => {
      if (erro) return next(erro);
      res.json({ token: req.session.csrf });
    });
  });
  app.use("/api", (req, res, next) => {
    if (!MUTACOES.has(req.method)) return next();
    const origin = req.get("origin");
    let origemInvalida = false;
    if (origin) {
      try { origemInvalida = new URL(origin).origin !== `${req.protocol}://${req.get("host")}`; }
      catch { origemInvalida = true; }
    }
    const token = req.get("x-csrf-token");
    const esperado = req.session.csrf;
    if (origemInvalida || req.get("sec-fetch-site") === "cross-site" ||
        !token || !esperado || !/^[a-f0-9]{64}$/.test(token) ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado))) {
      return res.status(403).json({ message: "Não foi possível validar o envio. Atualize a página e tente novamente.", code: "CSRF_INVALIDO" });
    }
    next();
  });
}

/** Recusa tipos inesperados, objetos excessivos e chaves de prototype pollution. */
export const validarCorpo: RequestHandler = (req, res, next) => {
  if (!MUTACOES.has(req.method) || req.body === undefined) return next();
  if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ message: "Envie um objeto JSON válido." });
  }
  let itens = 0;
  function invalido(v: unknown, nivel: number): boolean {
    if (++itens > 30000 || nivel > 20) return true;
    if (v === null || typeof v !== "object") return false;
    return Object.entries(v).some(([k, valor]) =>
      ["__proto__", "prototype", "constructor"].includes(k) || invalido(valor, nivel + 1));
  }
  if (invalido(req.body, 0)) return res.status(400).json({ message: "Estrutura de dados inválida ou excessiva." });
  next();
};

export const validarParametros: RequestHandler = (req, res, next) => {
  for (const [chave, valor] of Object.entries(req.params)) {
    if ((chave === "id" || chave.endsWith("Id")) &&
        (!/^[1-9]\d{0,9}$/.test(String(valor)) || Number(valor) > 2147483647)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }
  }
  next();
};
