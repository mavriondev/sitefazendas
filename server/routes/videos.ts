import type { Express } from "express";
import type { Db } from "../db";
import { idYoutube } from "../../shared/youtube";
import { vazaDadoSensivel } from "../lib/sigilo";
import type { FazendaRow } from "../lib/publico";

export function registrarRotasVideos(app: Express, db: Db, exigirAdmin: any) {
  async function salvar(req: any, res: any, novo: boolean) {
    const idRecebido = Number(novo ? req.params.id : req.params.videoId);
    if (!Number.isSafeInteger(idRecebido) || idRecebido <= 0) return res.status(400).json({ message: "Identificador inválido." });
    const anterior = novo ? null : (await db.query("SELECT * FROM fazenda_videos WHERE id=$1", [Number(req.params.videoId)])).rows[0];
    if (!novo && !anterior) return res.status(404).json({ message: "Vídeo não encontrado." });
    const fazendaId = novo ? Number(req.params.id) : anterior.fazenda_id;
    const f = (await db.query<FazendaRow>("SELECT * FROM fazendas WHERE id=$1", [fazendaId])).rows[0];
    if (!f) return res.status(404).json({ message: "Fazenda não encontrada." });
    const b = req.body ?? {};
    const youtubeId = idYoutube("url" in b ? b.url : anterior?.youtube_id);
    const titulo = typeof (b.titulo ?? anterior?.titulo) === "string" ? (b.titulo ?? anterior?.titulo).trim() : "";
    const ordem = b.ordem ?? anterior?.ordem ?? 0;
    const publico = b.publico ?? anterior?.publico ?? false;
    if (!youtubeId) return res.status(400).json({ message: "Informe um link válido do YouTube (watch, Shorts, live ou youtu.be)." });
    if (!titulo || titulo.length > 120) return res.status(400).json({ message: "Título obrigatório, até 120 caracteres." });
    if (!Number.isInteger(ordem) || Math.abs(ordem) > 100000) return res.status(400).json({ message: "Ordem inválida." });
    if (typeof publico !== "boolean") return res.status(400).json({ message: "Visibilidade inválida." });
    if (publico && vazaDadoSensivel(titulo, f).length) return res.status(409).json({ message: "O título do vídeo contém dados privados. Revise antes de torná-lo público." });
    if (novo) {
      const r = await db.query("INSERT INTO fazenda_videos (fazenda_id,youtube_id,titulo,ordem,publico) VALUES ($1,$2,$3,$4,$5) RETURNING id", [fazendaId,youtubeId,titulo,ordem,publico]);
      return res.status(201).json({ id: r.rows[0].id });
    }
    await db.query("UPDATE fazenda_videos SET youtube_id=$2,titulo=$3,ordem=$4,publico=$5 WHERE id=$1", [anterior.id,youtubeId,titulo,ordem,publico]);
    return res.json({ ok: true });
  }
  app.post("/api/admin/fazendas/:id/videos", exigirAdmin, (req,res,next) => { void salvar(req,res,true).catch(next); });
  app.put("/api/admin/videos/:videoId", exigirAdmin, (req,res,next) => { void salvar(req,res,false).catch(next); });
  app.delete("/api/admin/videos/:videoId", exigirAdmin, async (req,res,next) => {
    try {
      const id = Number(req.params.videoId);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Identificador inválido." });
      const r = await db.query("DELETE FROM fazenda_videos WHERE id=$1 RETURNING id", [id]);
      if (!r.rowCount) return res.status(404).json({ message: "Vídeo não encontrado." });
      res.json({ ok: true });
    } catch(e) { next(e); }
  });
}
