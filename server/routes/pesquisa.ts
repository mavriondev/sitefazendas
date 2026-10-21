import type { Express, Request, Response, NextFunction } from "express";
import type { Db } from "../db";
import { lerConfig } from "../config";
import { criarHub, type Hub } from "../lib/hub";
import { ajustarFiltros, anonimizarImovel, filtroSuficiente, tokenDoImovel, type FiltrosPesquisa, type Nivel } from "../lib/pesquisa";

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * Módulo B. TODAS as rotas passam pelo interruptor no servidor: com o módulo desligado, respondem 404 e
 * NÃO consultam a Hub. (O enriquecimento das fazendas do módulo A é outro caminho e continua funcionando.)
 */
export function registrarRotasPesquisa(app: Express, db: Db, exigirLogin: any, opts: { hub?: Hub; segredo: string }) {
  const hub = opts.hub ?? criarHub();

  const moduloAtivo = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await lerConfig(db)).modulo_pesquisa_ativo) return res.status(404).json({ message: "Pesquisa de terras indisponível no momento." });
      next();
    } catch (e) { next(e); }
  };

  app.get("/api/pesquisa/status", async (req, res) => {
    const c = await lerConfig(db);
    const u = (req as any).usuario;
    res.json({ ativo: c.modulo_pesquisa_ativo, logado: !!u, nivel: u?.nivel_acesso ?? null });
  });

  app.post("/api/pesquisa/buscar", moduloAtivo, exigirLogin, async (req, res) => {
    const u = (req as any).usuario;
    const cfg = await lerConfig(db);
    const nivel = u.nivel_acesso as Nivel;
    const b = req.body ?? {};
    const filtros = ajustarFiltros({
      uf: typeof b.uf === "string" ? b.uf : undefined,
      area_min: num(b.area_min), area_max: num(b.area_max),
      alt_media_min: num(b.altitude_min), alt_media_max: num(b.altitude_max),
      argila_media_min: num(b.argila_min), argila_media_max: num(b.argila_max),
      deslocamento: num(b.deslocamento),
    } as FiltrosPesquisa, nivel);
    if (!filtroSuficiente(filtros)) return res.status(400).json({ message: "Escolha o estado e ao menos um critério (área, altitude ou argila)." });

    const feitas = await db.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM pesquisa_consultas WHERE usuario_id = $1 AND criado_em > now() - interval '1 hour'", [u.id]);
    if (Number(feitas.rows[0].n) >= cfg.pesquisa_limite_hora && u.papel !== "admin") {
      return res.status(429).json({ message: "Limite de pesquisas por hora atingido. Tente mais tarde ou fale com o corretor." });
    }

    const r = await hub.buscar(filtros);
    if (!r.ok) return res.status(502).json({ message: r.motivo });

    const resultados = [];
    for (const im of r.data.imoveis) {
      if (!im.cod_imovel) continue;
      const token = tokenDoImovel(im.cod_imovel, opts.segredo);
      await db.query(
        "INSERT INTO pesquisa_tokens (token, cod_imovel, uf) VALUES ($1,$2,$3) ON CONFLICT (token) DO NOTHING",
        [token, im.cod_imovel, im.uf]);
      resultados.push(anonimizarImovel(im, token, nivel));
    }
    await db.query("INSERT INTO pesquisa_consultas (usuario_id, filtros, resultados) VALUES ($1,$2::jsonb,$3)", [u.id, JSON.stringify(filtros), resultados.length]);
    res.json({ total: r.data.total, resultados, nivel, filtros_aplicados: { ...filtros, limite: undefined } });
  });

  // O comprador pede para saber mais: vira um contato para o corretor (a intermediação é o ponto do módulo).
  app.post("/api/pesquisa/interesse", moduloAtivo, exigirLogin, async (req, res) => {
    const u = (req as any).usuario;
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const t = await db.query("SELECT 1 FROM pesquisa_tokens WHERE token = $1", [token]);
    if (!t.rowCount) return res.status(404).json({ message: "Imóvel não encontrado. Refaça a pesquisa." });
    const dup = await db.query("SELECT 1 FROM contatos WHERE usuario_id=$1 AND pesquisa_token=$2 AND criado_em > now() - interval '1 day'", [u.id, token]);
    if (dup.rowCount) return res.json({ ok: true, repetido: true });
    await db.query(
      `INSERT INTO contatos (usuario_id, pesquisa_token, nome, whatsapp, email, mensagem, origem) VALUES ($1,$2,$3,$4,$5,$6,'pesquisa')`,
      [u.id, token, u.nome, u.whatsapp, u.email, typeof req.body?.mensagem === "string" ? req.body.mensagem.trim().slice(0, 1000) || null : null]);
    res.status(201).json({ ok: true });
  });
}
