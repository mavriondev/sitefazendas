import type { Express, Request } from "express";
import multer from "multer";
import crypto from "node:crypto";
import type { Db } from "../db";
import { lerConfig, gravarConfig } from "../config";
import { limparTelefone } from "../auth";
import { gerarSlug } from "../lib/slug";
import { sanitizarImagem } from "../lib/foto";
import { validarGeoJsonPoligono, centroAproximado } from "../lib/geojson";
import { validarPublicacao, atributoParaPublico, type AtributoRow, type FazendaRow, type FotoRow } from "../lib/publico";
import { gravarManual, gravarAutomatico, validarEntradaManual } from "../lib/atributos-db";
import { ATRIBUTOS, chaveValida } from "../../shared/atributos";
import { ESTADOS } from "../../shared/confianca";
import { criarHub, type Hub } from "../lib/hub";
import { gerarTexto } from "../lib/ia";
import { apagarArquivo as apagarArquivoUpload, salvarArquivo } from "../lib/arquivos";

const STATUS = ["rascunho", "revisao", "publicada", "vendida", "arquivada"];

export interface OpcoesAdmin { uploadsDir: string; hub?: Hub; fetchIA?: typeof fetch }

const txt = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const idDe = (req: Request, nome = "id"): number => Number(req.params[nome]);

async function carregar(db: Db, id: number) {
  const f = (await db.query<FazendaRow>("SELECT * FROM fazendas WHERE id = $1", [id])).rows[0];
  if (!f) return null;
  const atributos = (await db.query<AtributoRow>("SELECT * FROM fazenda_atributos WHERE fazenda_id = $1 ORDER BY chave", [id])).rows;
  const fotos = (await db.query<FotoRow>("SELECT * FROM fazenda_fotos WHERE fazenda_id = $1 ORDER BY capa DESC, ordem, id", [id])).rows;
  return { f, atributos, fotos };
}

/** Aplica o corpo da requisição sobre a fazenda (allowlist). Devolve valores novos ou erro. */
export function aplicarCamposFazenda(f: FazendaRow, b: Record<string, any>): { erro?: string; novo?: FazendaRow } {
  const n: any = { ...f };
  const e = (m: string) => ({ erro: m });
  if ("titulo" in b) { const t = txt(b.titulo, 150); if (!t) return e("Título obrigatório."); n.titulo = t; }
  if ("descricao_publica" in b) n.descricao_publica = txt(b.descricao_publica, 4000);
  if ("regiao_publica" in b) n.regiao_publica = txt(b.regiao_publica, 120);
  if ("culturas" in b) {
    if (!Array.isArray(b.culturas) || b.culturas.length > 12) return e("Culturas: até 12 itens.");
    n.culturas = b.culturas.map((c: unknown) => txt(c, 40)).filter(Boolean);
  }
  if ("area_ha" in b) {
    if (b.area_ha === null || b.area_ha === "") n.area_ha = null;
    else if (typeof b.area_ha === "number" && b.area_ha > 0 && b.area_ha < 1e7) n.area_ha = b.area_ha;
    else return e("Área inválida.");
  }
  if ("area_exibicao" in b) { if (!["exata", "faixa"].includes(b.area_exibicao)) return e("area_exibicao inválida."); n.area_exibicao = b.area_exibicao; }
  if ("preco_exibicao" in b) n.preco_exibicao = txt(b.preco_exibicao, 80);
  if ("mostrar_mapa" in b) n.mostrar_mapa = b.mostrar_mapa === true;
  if ("mostrar_regiao" in b) n.mostrar_regiao = b.mostrar_regiao === true;
  if ("destaque" in b) n.destaque = b.destaque === true;
  if ("destaque_ordem" in b) { if (!Number.isInteger(b.destaque_ordem)) return e("Ordem inválida."); n.destaque_ordem = b.destaque_ordem; }
  if ("whatsapp_proprio" in b) {
    if (!b.whatsapp_proprio) n.whatsapp_proprio = null;
    else { const t = limparTelefone(b.whatsapp_proprio); if (!t) return e("WhatsApp inválido."); n.whatsapp_proprio = t; }
  }
  if ("car_codigo" in b) n.car_codigo = txt(b.car_codigo, 60);
  if ("municipio" in b) n.municipio = txt(b.municipio, 120);
  if ("uf" in b) { const u = txt(b.uf, 2)?.toUpperCase() ?? null; if (u && !/^[A-Z]{2}$/.test(u)) return e("UF inválida."); n.uf = u; }
  if ("latitude" in b || "longitude" in b) {
    const la = b.latitude ?? null, lo = b.longitude ?? null;
    if ((la === null) !== (lo === null)) return e("Informe latitude e longitude juntas.");
    if (la !== null && !(typeof la === "number" && typeof lo === "number" && la >= -35 && la <= 6 && lo >= -75 && lo <= -30)) return e("Coordenadas fora do Brasil.");
    n.latitude = la; n.longitude = lo;
  }
  if ("geojson" in b) {
    if (b.geojson === null || b.geojson === "") n.geojson = null;
    else {
      const g = validarGeoJsonPoligono(b.geojson); if (!g) return e("Polígono inválido (use Polygon/MultiPolygon em GeoJSON).");
      n.geojson = g;
      if (n.latitude == null && n.longitude == null) { const c = centroAproximado(g); if (c) { n.latitude = c.lat; n.longitude = c.lon; } } // referência privada
    }
  }
  if ("notas_internas" in b) n.notas_internas = txt(b.notas_internas, 4000);
  return { novo: n };
}

const COLUNAS_EDITAVEIS = [
  "titulo", "descricao_publica", "regiao_publica", "culturas", "area_ha", "area_exibicao", "preco_exibicao", "mostrar_mapa", "mostrar_regiao",
  "destaque", "destaque_ordem", "whatsapp_proprio", "car_codigo", "municipio", "uf", "latitude", "longitude", "geojson", "notas_internas",
] as const;

export function registrarRotasAdmin(app: Express, db: Db, exigirAdmin: any, op: OpcoesAdmin) {
  const hub = op.hub ?? criarHub();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 } });

  async function salvarImagem(buf: Buffer): Promise<string | null> {
    const limpa = sanitizarImagem(buf); // remove EXIF/GPS; rejeita o que não for JPEG/PNG
    if (!limpa) return null;
    const nome = `${crypto.randomBytes(16).toString("hex")}.${limpa.tipo === "jpeg" ? "jpg" : "png"}`;
    await salvarArquivo(op.uploadsDir, nome, limpa.dados);
    return nome;
  }
  const apagarArquivo = (nome: string | null) => { void apagarArquivoUpload(op.uploadsDir, nome); };

  // ---------- fazendas ----------
  app.get("/api/admin/fazendas", exigirAdmin, async (_req, res) => {
    const r = await db.query(
      `SELECT f.id, f.slug, f.titulo, f.status, f.destaque, f.regiao_publica, f.area_ha, f.car_codigo, f.municipio, f.uf, f.atualizado_em,
              (SELECT COUNT(*) FROM fazenda_fotos p WHERE p.fazenda_id = f.id) AS fotos
         FROM fazendas f ORDER BY f.atualizado_em DESC`,
    );
    res.json({ fazendas: r.rows });
  });

  app.post("/api/admin/fazendas", exigirAdmin, async (req, res) => {
    const titulo = txt(req.body?.titulo, 150);
    if (!titulo) return res.status(400).json({ message: "Informe o título." });
    const r = await db.query<{ id: number }>("INSERT INTO fazendas (slug, titulo) VALUES ($1,$2) RETURNING id", [gerarSlug(titulo), titulo]);
    const id = r.rows[0].id;
    const extra: Record<string, unknown> = {};
    for (const k of COLUNAS_EDITAVEIS) if (k !== "titulo" && k in (req.body ?? {})) extra[k] = req.body[k];
    if (Object.keys(extra).length) {
      const c = await carregar(db, id);
      const ap = aplicarCamposFazenda(c!.f, extra);
      if (ap.erro) { await db.query("DELETE FROM fazendas WHERE id=$1", [id]); return res.status(400).json({ message: ap.erro }); }
      await salvarCampos(id, ap.novo!);
    }
    res.status(201).json({ id });
  });

  async function salvarCampos(id: number, n: FazendaRow) {
    await db.query(
      `UPDATE fazendas SET titulo=$2, descricao_publica=$3, regiao_publica=$4, culturas=$5, area_ha=$6, area_exibicao=$7, preco_exibicao=$8,
         mostrar_mapa=$9, destaque=$10, destaque_ordem=$11, whatsapp_proprio=$12, car_codigo=$13, municipio=$14, uf=$15,
         latitude=$16, longitude=$17, geojson=$18::jsonb, notas_internas=$19, mostrar_regiao=$20, atualizado_em=now() WHERE id=$1`,
      [id, n.titulo, n.descricao_publica, n.regiao_publica, n.culturas, n.area_ha, n.area_exibicao, n.preco_exibicao,
        n.mostrar_mapa, n.destaque, n.destaque_ordem, n.whatsapp_proprio, n.car_codigo, n.municipio, n.uf,
        n.latitude, n.longitude, n.geojson ? JSON.stringify(n.geojson) : null, n.notas_internas, n.mostrar_regiao],
    );
  }

  app.get("/api/admin/fazendas/:id", exigirAdmin, async (req, res) => {
    const c = await carregar(db, idDe(req));
    if (!c) return res.status(404).json({ message: "Fazenda não encontrada." });
    res.json({
      fazenda: c.f, atributos: c.atributos, fotos: c.fotos,
      problemas_publicacao: validarPublicacao(c.f, c.fotos, c.atributos),
      atributos_catalogo: ATRIBUTOS,
      previa_publica: c.atributos.map(atributoParaPublico).filter(Boolean),
    });
  });

  app.put("/api/admin/fazendas/:id", exigirAdmin, async (req, res) => {
    const id = idDe(req);
    const c = await carregar(db, id);
    if (!c) return res.status(404).json({ message: "Fazenda não encontrada." });
    const ap = aplicarCamposFazenda(c.f, req.body ?? {});
    if (ap.erro) return res.status(400).json({ message: ap.erro });
    // Fazenda já publicada: não deixa a edição introduzir vazamento nem esvaziar campos obrigatórios.
    if (c.f.status === "publicada") {
      const prob = validarPublicacao(ap.novo!, c.fotos, c.atributos);
      if (prob.length) return res.status(409).json({ message: "A edição deixaria a fazenda publicada fora das regras.", problemas: prob });
    }
    await salvarCampos(id, ap.novo!);
    res.json({ ok: true });
  });


  app.delete("/api/admin/fazendas/:id", exigirAdmin, async (req, res) => {
    const id = idDe(req);
    const c = await carregar(db, id);
    if (!c) return res.status(404).json({ message: "Fazenda não encontrada." });
    if (c.f.status === "publicada") return res.status(409).json({ message: "Despublique ou arquive a fazenda antes de excluir." });
    await db.query("DELETE FROM fazendas WHERE id=$1", [id]); // fotos e atributos saem em cascata
    for (const f of c.fotos) apagarArquivo(f.arquivo);
    res.json({ ok: true });
  });

  app.post("/api/admin/fazendas/:id/status", exigirAdmin, async (req, res) => {
    const id = idDe(req);
    const status = req.body?.status;
    if (!STATUS.includes(status)) return res.status(400).json({ message: "Status inválido." });
    const c = await carregar(db, id);
    if (!c) return res.status(404).json({ message: "Fazenda não encontrada." });
    if (status === "publicada") {
      const prob = validarPublicacao(c.f, c.fotos, c.atributos);
      if (prob.length) return res.status(409).json({ message: "Não é possível publicar ainda.", problemas: prob });
    }
    await db.query(
      `UPDATE fazendas SET status=$2, publicado_em = CASE WHEN $2='publicada' AND publicado_em IS NULL THEN now() ELSE publicado_em END, atualizado_em=now() WHERE id=$1`,
      [id, status],
    );
    res.json({ ok: true });
  });

  // ---------- atributos ----------
  app.put("/api/admin/fazendas/:id/atributos/:chave", exigirAdmin, async (req, res) => {
    const id = idDe(req); const chave = String(req.params.chave);
    if (!chaveValida(chave)) return res.status(404).json({ message: "Atributo desconhecido." });
    if (!(await db.query("SELECT 1 FROM fazendas WHERE id=$1", [id])).rowCount) return res.status(404).json({ message: "Fazenda não encontrada." });
    const erro = validarEntradaManual(chave, req.body ?? {});
    if (erro) return res.status(400).json({ message: erro });
    await gravarManual(db, id, chave, req.body);
    // Se a fazenda está publicada, a mudança não pode violar as regras.
    const c = await carregar(db, id);
    if (c!.f.status === "publicada") {
      const prob = validarPublicacao(c!.f, c!.fotos, c!.atributos);
      if (prob.length) {
        await db.query("UPDATE fazenda_atributos SET publico = FALSE WHERE fazenda_id=$1 AND chave=$2", [id, chave]);
        return res.status(409).json({ message: "Atributo salvo como privado: tornar público violaria as regras.", problemas: prob });
      }
    }
    res.json({ ok: true });
  });

  app.put("/api/admin/fazendas/:id/atributos/:chave/publico", exigirAdmin, async (req, res) => {
    const id = idDe(req); const chave = String(req.params.chave);
    const publico = req.body?.publico === true;
    const def = ATRIBUTOS.find((a) => a.chave === chave);
    if (!def) return res.status(404).json({ message: "Atributo desconhecido." });
    if (publico && !def.publicavel) return res.status(400).json({ message: `"${def.rotulo}" nunca pode ser público.` });
    const r = await db.query<{ estado: string }>("SELECT estado FROM fazenda_atributos WHERE fazenda_id=$1 AND chave=$2", [id, chave]);
    if (!r.rows[0]) return res.status(404).json({ message: "Atributo não cadastrado nesta fazenda." });
    if (publico && !ESTADOS.slice(0, 2).includes(r.rows[0].estado as any)) return res.status(400).json({ message: "Atributo sem dado não pode ser público." });
    await db.query("UPDATE fazenda_atributos SET publico=$3 WHERE fazenda_id=$1 AND chave=$2", [id, chave, publico]);
    const c = await carregar(db, id);
    if (publico && c!.f.status === "publicada") {
      const prob = validarPublicacao(c!.f, c!.fotos, c!.atributos);
      if (prob.length) { await db.query("UPDATE fazenda_atributos SET publico=FALSE WHERE fazenda_id=$1 AND chave=$2", [id, chave]); return res.status(409).json({ message: "Violaria as regras de publicação.", problemas: prob }); }
    }
    res.json({ ok: true });
  });

  app.delete("/api/admin/fazendas/:id/atributos/:chave", exigirAdmin, async (req, res) => {
    await db.query("DELETE FROM fazenda_atributos WHERE fazenda_id=$1 AND chave=$2", [idDe(req), String(req.params.chave)]);
    res.json({ ok: true });
  });

  // ---------- enriquecimento pela Hub API (a partir do CAR) ----------
  app.post("/api/admin/fazendas/:id/enriquecer", exigirAdmin, async (req, res) => {
    const id = idDe(req);
    const c = await carregar(db, id);
    if (!c) return res.status(404).json({ message: "Fazenda não encontrada." });
    if (!c.f.car_codigo) return res.status(400).json({ message: "Cadastre o código do CAR para enriquecer. Sem CAR, preencha os dados manualmente." });
    const r = await hub.buscarPorCodigo(c.f.car_codigo);
    if (!r.ok) return res.status(502).json({ message: r.motivo });
    if (!r.data) return res.status(404).json({ message: "CAR não encontrado na base. Confira o código ou preencha manualmente." });
    const im = r.data;
    const fonte = "Base SICAR espelhada (Hub Mavrion): altitude SRTM 90 m e argila OpenGeoHub 250 m (modelos, não medição em campo)";
    const resultado: Record<string, string> = {};
    const reg = async (chave: string, valor: number | null, obs?: string) => {
      resultado[chave] = valor === null
        ? await gravarAutomatico(db, id, chave, { achado: "indeterminado", fonte, observacao: "A base não tem este dado para o imóvel." })
        : await gravarAutomatico(db, id, chave, { achado: "detectado", valor: Math.round(valor * 10) / 10, fonte, observacao: obs });
    };
    await reg("altitude_media", im.alt_media, im.alt_min !== null && im.alt_max !== null ? `Variação entre ${Math.round(im.alt_min)} e ${Math.round(im.alt_max)} m nas amostras.` : undefined);
    await reg("argila_media", im.argila_media, "Média ponderada das camadas até 1 m; estimativa de modelo.");
    // Dados privados / cadastrais: só preenche o que está vazio (não sobrescreve o que o corretor digitou).
    const sets: string[] = []; const params: unknown[] = [id];
    const preencher = (col: string, val: unknown, vazio: boolean) => { if (vazio && val !== null && val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); } };
    preencher("area_ha", im.area_ha, c.f.area_ha == null);
    preencher("municipio", im.municipio, !c.f.municipio);
    preencher("uf", im.uf, !c.f.uf);
    const geo = im.geojson ? validarGeoJsonPoligono(im.geojson) : null;
    if (geo && !c.f.geojson) { params.push(JSON.stringify(geo)); sets.push(`geojson = $${params.length}::jsonb`); }
    const cen = geo ? centroAproximado(geo) : null;
    if (cen && c.f.latitude == null) { params.push(cen.lat, cen.lon); sets.push(`latitude = $${params.length - 1}`, `longitude = $${params.length}`); }
    if (sets.length) await db.query(`UPDATE fazendas SET ${sets.join(", ")}, atualizado_em = now() WHERE id = $1`, params);
    res.json({ ok: true, resultado, preenchido: sets.length > 0 });
  });

  // ---------- texto por IA (sugestão; nunca salva sozinho) ----------
  app.post("/api/admin/fazendas/:id/texto-ia", exigirAdmin, async (req, res) => {
    const c = await carregar(db, idDe(req));
    if (!c) return res.status(404).json({ message: "Fazenda não encontrada." });
    const f = c.f;
    // Para a IA, só atributos que PODERIAM ser públicos (sem dado e privados ficam de fora).
    const atributos = c.atributos.map((a) => atributoParaPublico({ ...a, publico: true })).filter((x): x is NonNullable<typeof x> => !!x)
      .map((a) => ({ rotulo: a.rotulo, texto: a.texto, confianca: a.confianca }));
    const area = f.area_ha != null ? (f.area_exibicao === "faixa" ? null : `${Number(f.area_ha).toLocaleString("pt-BR")} ha`) : null;
    const r = await gerarTexto(
      { titulo: f.titulo, regiao_publica: f.regiao_publica, area, culturas: f.culturas ?? [], atributos, observacoes_do_corretor: txt(req.body?.observacoes, 800) ?? undefined },
      { municipio: f.municipio, uf: f.uf, car_codigo: f.car_codigo, latitude: f.latitude, longitude: f.longitude },
      { fetchFn: op.fetchIA },
    );
    if (!r.ok) return res.status(502).json({ message: r.motivo });
    res.json({ sugestao: r.texto });
  });

  // ---------- fotos ----------
  app.post("/api/admin/fazendas/:id/fotos", exigirAdmin, upload.single("arquivo"), async (req, res) => {
    const id = idDe(req);
    if (!(await db.query("SELECT 1 FROM fazendas WHERE id=$1", [id])).rowCount) return res.status(404).json({ message: "Fazenda não encontrada." });
    if (!req.file) return res.status(400).json({ message: "Envie um arquivo JPEG ou PNG." });
    const nome = await salvarImagem(req.file.buffer);
    if (!nome) return res.status(415).json({ message: "Formato não aceito. Use JPEG ou PNG." });
    const temCapa = (await db.query("SELECT 1 FROM fazenda_fotos WHERE fazenda_id=$1 AND capa", [id])).rowCount > 0;
    const ordem = Number((await db.query<{ m: string }>("SELECT COALESCE(MAX(ordem),0)+1 AS m FROM fazenda_fotos WHERE fazenda_id=$1", [id])).rows[0].m);
    const r = await db.query<{ id: number }>(
      "INSERT INTO fazenda_fotos (fazenda_id, arquivo, ordem, capa, legenda) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [id, nome, ordem, !temCapa, txt(req.body?.legenda, 200)],
    );
    res.status(201).json({ id: r.rows[0].id, arquivo: nome });
  });

  app.put("/api/admin/fotos/:fotoId", exigirAdmin, async (req, res) => {
    const fid = idDe(req, "fotoId");
    const r = await db.query<{ fazenda_id: number }>("SELECT fazenda_id FROM fazenda_fotos WHERE id=$1", [fid]);
    if (!r.rows[0]) return res.status(404).json({ message: "Foto não encontrada." });
    const fazId = r.rows[0].fazenda_id;
    if ("legenda" in (req.body ?? {})) {
      const c = await carregar(db, fazId);
      const leg = txt(req.body.legenda, 200);
      const fakeFotos = c!.fotos.map((x) => (x.id === fid ? { ...x, legenda: leg } : x));
      if (c!.f.status === "publicada") {
        const prob = validarPublicacao(c!.f, fakeFotos, c!.atributos);
        if (prob.length) return res.status(409).json({ message: "A legenda violaria as regras.", problemas: prob });
      }
      await db.query("UPDATE fazenda_fotos SET legenda=$2 WHERE id=$1", [fid, leg]);
    }
    if (Number.isInteger(req.body?.ordem)) await db.query("UPDATE fazenda_fotos SET ordem=$2 WHERE id=$1", [fid, req.body.ordem]);
    if (req.body?.capa === true) {
      await db.query("UPDATE fazenda_fotos SET capa = (id = $2) WHERE fazenda_id = $1", [fazId, fid]);
    }
    res.json({ ok: true });
  });

  app.delete("/api/admin/fotos/:fotoId", exigirAdmin, async (req, res) => {
    const fid = idDe(req, "fotoId");
    const r = await db.query<{ arquivo: string; fazenda_id: number; capa: boolean }>("SELECT arquivo, fazenda_id, capa FROM fazenda_fotos WHERE id=$1", [fid]);
    if (!r.rows[0]) return res.status(404).json({ message: "Foto não encontrada." });
    const c = await carregar(db, r.rows[0].fazenda_id);
    if (c!.f.status === "publicada" && c!.fotos.length <= 1) return res.status(409).json({ message: "Uma fazenda publicada precisa ter ao menos uma foto." });
    await db.query("DELETE FROM fazenda_fotos WHERE id=$1", [fid]);
    apagarArquivo(r.rows[0].arquivo);
    if (r.rows[0].capa) await db.query("UPDATE fazenda_fotos SET capa = TRUE WHERE id = (SELECT id FROM fazenda_fotos WHERE fazenda_id=$1 ORDER BY ordem, id LIMIT 1)", [r.rows[0].fazenda_id]);
    res.json({ ok: true });
  });

  // ---------- slides ----------
  const slideValido = async (b: any): Promise<{ erro?: string; v?: any }> => {
    const titulo = txt(b.titulo, 120), subtitulo = txt(b.subtitulo, 200);
    const tipo = b.link_tipo ?? "nenhum";
    if (!["nenhum", "fazenda", "url"].includes(tipo)) return { erro: "link_tipo inválido." };
    let fazendaId: number | null = null, url: string | null = null;
    if (tipo === "fazenda") {
      fazendaId = Number(b.fazenda_id);
      if (!(await db.query("SELECT 1 FROM fazendas WHERE id=$1", [fazendaId])).rowCount) return { erro: "Fazenda do slide não existe." };
    }
    if (tipo === "url") { url = txt(b.url, 500); if (!url || !/^https?:\/\//i.test(url)) return { erro: "URL deve começar com http:// ou https://." }; }
    return { v: { titulo, subtitulo, tipo, fazendaId, url, ordem: Number.isInteger(b.ordem) ? b.ordem : 0, ativo: b.ativo !== false } };
  };
  app.get("/api/admin/slides", exigirAdmin, async (_req, res) => res.json({ slides: (await db.query("SELECT * FROM slides ORDER BY ordem, id")).rows }));
  app.post("/api/admin/slides", exigirAdmin, async (req, res) => {
    const { erro, v } = await slideValido(req.body ?? {});
    if (erro) return res.status(400).json({ message: erro });
    const r = await db.query<{ id: number }>("INSERT INTO slides (titulo, subtitulo, link_tipo, fazenda_id, url, ordem, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [v.titulo, v.subtitulo, v.tipo, v.fazendaId, v.url, v.ordem, v.ativo]);
    res.status(201).json({ id: r.rows[0].id });
  });
  app.put("/api/admin/slides/:id", exigirAdmin, async (req, res) => {
    const { erro, v } = await slideValido(req.body ?? {});
    if (erro) return res.status(400).json({ message: erro });
    await db.query("UPDATE slides SET titulo=$2, subtitulo=$3, link_tipo=$4, fazenda_id=$5, url=$6, ordem=$7, ativo=$8 WHERE id=$1",
      [idDe(req), v.titulo, v.subtitulo, v.tipo, v.fazendaId, v.url, v.ordem, v.ativo]);
    res.json({ ok: true });
  });
  app.post("/api/admin/slides/:id/imagem", exigirAdmin, upload.single("arquivo"), async (req, res) => {
    const id = idDe(req);
    const s = await db.query<{ arquivo: string | null }>("SELECT arquivo FROM slides WHERE id=$1", [id]);
    if (!s.rows[0]) return res.status(404).json({ message: "Slide não encontrado." });
    if (!req.file) return res.status(400).json({ message: "Envie um arquivo JPEG ou PNG." });
    const nome = await salvarImagem(req.file.buffer);
    if (!nome) return res.status(415).json({ message: "Formato não aceito. Use JPEG ou PNG." });
    await db.query("UPDATE slides SET arquivo=$2 WHERE id=$1", [id, nome]);
    apagarArquivo(s.rows[0].arquivo);
    res.json({ ok: true, arquivo: nome });
  });
  app.delete("/api/admin/slides/:id", exigirAdmin, async (req, res) => {
    const s = await db.query<{ arquivo: string | null }>("DELETE FROM slides WHERE id=$1 RETURNING arquivo", [idDe(req)]);
    apagarArquivo(s.rows[0]?.arquivo ?? null);
    res.json({ ok: true });
  });


  // ---------- parceiros (marcas na página Parceiros) ----------
  const parceiroValido = (b: any): { erro?: string; v?: any } => {
    const nome = txt(b.nome, 100);
    if (!nome) return { erro: "Informe o nome do parceiro." };
    const url = txt(b.url, 300);
    if (url && !/^https?:\/\//i.test(url)) return { erro: "O site do parceiro deve começar com http:// ou https://." };
    return { v: { nome, url, ordem: Number.isInteger(b.ordem) ? b.ordem : 0, ativo: b.ativo !== false } };
  };
  app.get("/api/admin/parceiros", exigirAdmin, async (_req, res) => res.json({ parceiros: (await db.query("SELECT * FROM parceiros ORDER BY ordem, id")).rows }));
  app.post("/api/admin/parceiros", exigirAdmin, async (req, res) => {
    const { erro, v } = parceiroValido(req.body ?? {});
    if (erro) return res.status(400).json({ message: erro });
    const r = await db.query<{ id: number }>("INSERT INTO parceiros (nome, url, ordem, ativo) VALUES ($1,$2,$3,$4) RETURNING id", [v.nome, v.url, v.ordem, v.ativo]);
    res.status(201).json({ id: r.rows[0].id });
  });
  app.put("/api/admin/parceiros/:id", exigirAdmin, async (req, res) => {
    const { erro, v } = parceiroValido(req.body ?? {});
    if (erro) return res.status(400).json({ message: erro });
    await db.query("UPDATE parceiros SET nome=$2, url=$3, ordem=$4, ativo=$5 WHERE id=$1", [idDe(req), v.nome, v.url, v.ordem, v.ativo]);
    res.json({ ok: true });
  });
  app.post("/api/admin/parceiros/:id/logo", exigirAdmin, upload.single("arquivo"), async (req, res) => {
    const id = idDe(req);
    const s = await db.query<{ arquivo: string | null }>("SELECT arquivo FROM parceiros WHERE id=$1", [id]);
    if (!s.rows[0]) return res.status(404).json({ message: "Parceiro não encontrado." });
    if (!req.file) return res.status(400).json({ message: "Envie um arquivo JPEG ou PNG." });
    const nome = await salvarImagem(req.file.buffer);
    if (!nome) return res.status(415).json({ message: "Formato não aceito. Use JPEG ou PNG." });
    await db.query("UPDATE parceiros SET arquivo=$2 WHERE id=$1", [id, nome]);
    apagarArquivo(s.rows[0].arquivo);
    res.json({ ok: true, arquivo: nome });
  });
  app.delete("/api/admin/parceiros/:id", exigirAdmin, async (req, res) => {
    const s = await db.query<{ arquivo: string | null }>("DELETE FROM parceiros WHERE id=$1 RETURNING arquivo", [idDe(req)]);
    apagarArquivo(s.rows[0]?.arquivo ?? null);
    res.json({ ok: true });
  });

  // ---------- configurações ----------
  app.get("/api/admin/config", exigirAdmin, async (_req, res) => res.json(await lerConfig(db)));
  app.put("/api/admin/config", exigirAdmin, async (req, res) => {
    const erro = await gravarConfig(db, req.body ?? {});
    if (erro) return res.status(400).json({ message: erro });
    res.json(await lerConfig(db));
  });

  // ---------- usuários ----------
  app.get("/api/admin/usuarios", exigirAdmin, async (_req, res) => {
    const r = await db.query("SELECT id, email, nome, whatsapp, papel, nivel_acesso, bloqueado, criado_em, ultimo_login_em FROM usuarios ORDER BY criado_em DESC LIMIT 500");
    res.json({ usuarios: r.rows });
  });
  app.put("/api/admin/usuarios/:id", exigirAdmin, async (req, res) => {
    const id = idDe(req);
    const eu = (req as any).usuario;
    const b = req.body ?? {};
    if (id === eu.id && (b.bloqueado === true || (b.nivel_acesso && b.nivel_acesso !== "completo"))) return res.status(400).json({ message: "Você não pode reduzir o próprio acesso." });
    if ("nivel_acesso" in b) {
      if (!["aberto", "desbloqueado", "completo"].includes(b.nivel_acesso)) return res.status(400).json({ message: "Nível inválido." });
      await db.query("UPDATE usuarios SET nivel_acesso=$2 WHERE id=$1", [id, b.nivel_acesso]);
    }
    if ("bloqueado" in b) await db.query("UPDATE usuarios SET bloqueado=$2 WHERE id=$1", [id, b.bloqueado === true]);
    res.json({ ok: true });
  });


  // Link de redefinição de senha (uso único, 1 hora). O admin envia ao usuário pelo WhatsApp.
  app.post("/api/admin/usuarios/:id/link-senha", exigirAdmin, async (req, res) => {
    const id = idDe(req);
    if (!(await db.query("SELECT 1 FROM usuarios WHERE id=$1", [id])).rowCount) return res.status(404).json({ message: "Usuário não encontrado." });
    const token = crypto.randomBytes(24).toString("hex");
    await db.query("UPDATE usuarios SET reset_hash=$2, reset_expira=now() + interval '1 hour' WHERE id=$1", [id, crypto.createHash("sha256").update(token).digest("hex")]);
    res.json({ caminho: `/redefinir-senha?token=${token}`, expira_em_minutos: 60 });
  });

  // Exclusão de usuário (LGPD): remove a conta e anonimiza os contatos feitos por ela. Registros de apresentação são mantidos (prova de intermediação).
  app.delete("/api/admin/usuarios/:id", exigirAdmin, async (req, res) => {
    const id = idDe(req);
    const eu = (req as any).usuario;
    if (id === eu.id) return res.status(400).json({ message: "Você não pode excluir a própria conta." });
    const u = await db.query<{ papel: string }>("SELECT papel FROM usuarios WHERE id=$1", [id]);
    if (!u.rows[0]) return res.status(404).json({ message: "Usuário não encontrado." });
    if (u.rows[0].papel === "admin") {
      const n = await db.query<{ n: string }>("SELECT COUNT(*) AS n FROM usuarios WHERE papel='admin'");
      if (Number(n.rows[0].n) <= 1) return res.status(400).json({ message: "Não é possível excluir o único administrador." });
    }
    await db.query("UPDATE contatos SET nome='Removido', whatsapp=NULL, email=NULL, mensagem=NULL WHERE usuario_id=$1", [id]);
    await db.query("DELETE FROM usuarios WHERE id=$1", [id]);
    res.json({ ok: true });
  });

  // ---------- contatos e registro de apresentação ----------
  app.get("/api/admin/contatos", exigirAdmin, async (_req, res) => {
    const r = await db.query(
      `SELECT c.*, f.titulo AS fazenda_titulo, pt.cod_imovel AS pesquisa_cod_imovel, pt.uf AS pesquisa_uf
         FROM contatos c LEFT JOIN fazendas f ON f.id = c.fazenda_id LEFT JOIN pesquisa_tokens pt ON pt.token = c.pesquisa_token
        ORDER BY c.criado_em DESC LIMIT 500`,
    );
    res.json({ contatos: r.rows });
  });
  app.put("/api/admin/contatos/:id", exigirAdmin, async (req, res) => {
    if (!["novo", "atendido"].includes(req.body?.status)) return res.status(400).json({ message: "Status inválido." });
    await db.query("UPDATE contatos SET status=$2 WHERE id=$1", [idDe(req), req.body.status]);
    res.json({ ok: true });
  });
  app.get("/api/admin/apresentacoes", exigirAdmin, async (_req, res) => {
    const r = await db.query(`SELECT a.*, f.titulo AS fazenda_titulo FROM apresentacoes a LEFT JOIN fazendas f ON f.id = a.fazenda_id ORDER BY a.apresentado_em DESC LIMIT 500`);
    res.json({ apresentacoes: r.rows });
  });
  app.post("/api/admin/apresentacoes", exigirAdmin, async (req, res) => {
    const b = req.body ?? {};
    const nome = txt(b.comprador_nome, 120);
    if (!nome) return res.status(400).json({ message: "Informe o nome do comprador." });
    let fazendaId: number | null = null;
    if (b.fazenda_id != null) {
      fazendaId = Number(b.fazenda_id);
      if (!(await db.query("SELECT 1 FROM fazendas WHERE id=$1", [fazendaId])).rowCount) return res.status(400).json({ message: "Fazenda não existe." });
    }
    const token = txt(b.pesquisa_token, 80);
    if (!fazendaId && !token) return res.status(400).json({ message: "Informe a fazenda ou o código da pesquisa." });
    const r = await db.query<{ id: number; apresentado_em: string }>(
      `INSERT INTO apresentacoes (fazenda_id, pesquisa_token, comprador_nome, comprador_contato, canal, observacao, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, apresentado_em`,
      [fazendaId, token, nome, txt(b.comprador_contato, 120), txt(b.canal, 40), txt(b.observacao, 500), (req as any).usuario.id],
    );
    res.status(201).json(r.rows[0]);
  });
}
