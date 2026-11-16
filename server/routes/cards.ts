import type { Express } from "express";
import type { Db } from "../db";
import type { FazendaRow } from "../lib/publico";
import { validarCards } from "../../shared/cards";
import { problemasCards } from "../lib/cards";

export function registrarRotasCards(app: Express, db: Db, exigirAdmin: any) {
  app.put("/api/admin/fazendas/:id/cards", exigirAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const f = (await db.query<FazendaRow>("SELECT * FROM fazendas WHERE id=$1", [id])).rows[0];
    if (!f) return res.status(404).json({ message: "Fazenda não encontrada." });
    if (!req.body || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, "cards")) {
      return res.status(400).json({ message: "Envie somente a coleção de cards." });
    }
    const r = validarCards(req.body.cards);
    if (r.erro) return res.status(400).json({ message: r.erro });
    const problemas = problemasCards(r.cards, f);
    // Mesmo rascunhos precisam de autorização para deixar texto marcado para divulgação.
    if (problemas.length) return res.status(409).json({ message: "Revise os cards destinados à publicação.", problemas });
    // Substituição atômica: ordem e conteúdo nunca ficam parcialmente salvos.
    await db.query("UPDATE fazendas SET cards=$2::jsonb, atualizado_em=now() WHERE id=$1", [id, JSON.stringify(r.cards)]);
    res.json({ ok: true });
  });
}
