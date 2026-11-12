import type { Express } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import type { Database } from "./db";
import { asyncRoute as route, who, canFarm, check, text, id, uuid, event } from "./security";
import { sanitizarImagem } from "../../server/lib/foto";
export function inspectDocument(buf: Buffer, name: string) {
  const ext = path.extname(name).toLowerCase();
  if ([".png", ".jpg", ".jpeg"].includes(ext)) {
    const clean = sanitizarImagem(buf); check(clean, 415, "Imagem inválida. Envie JPEG ou PNG.");
    return { data: clean.dados, ext: clean.tipo === "jpeg" ? ".jpg" : ".png", mime: clean.tipo === "jpeg" ? "image/jpeg" : "image/png" };
  }
  check(ext === ".pdf" && /^%PDF-1\.[0-7]/.test(buf.subarray(0, 16).toString("latin1")) && /%%EOF\s*$/.test(buf.subarray(-1024).toString("latin1")), 415, "Envie PDF, JPEG ou PNG válido.");
  const tokens = buf.toString("latin1").replace(/#([0-9a-f]{2})/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  check(!/\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|Filespec|XFA|RichMedia|AcroForm|ObjStm|Encrypt|GoToR|SubmitForm|ImportData)\b/i.test(tokens), 415, "PDF com recursos ativos, anexos ou criptografia não é aceito. Exporte uma cópia simples.");
  return { data: buf, ext: ".pdf", mime: "application/pdf" };
}
export function safeName(name: string, ext: string) {
  const stem = path.basename(name.replace(/\\/g, "/"), path.extname(name)).normalize("NFKC").replace(/[^a-zA-Z0-9À-ÿ _.-]/g, "").slice(0, 110).replace(/^\.+/, "").trim();
  return (stem || "Documento") + ext;
}
export async function listDocuments(db: Database, fid: number) {
  return (await db.query(`SELECT d.id,d.fazenda_id,d.nome,d.categoria,d.descricao,d.tamanho,d.criado_em,u.nome AS autor_nome FROM crm_documents d
    JOIN crm_users u ON u.id=d.criado_por WHERE fazenda_id=$1 ORDER BY criado_em DESC,id DESC`, [fid])).rows;
}
export function documentRoutes(app: Express, db: Database, docsDir: string) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 3, fieldSize: 2000, parts: 5 } });
  app.post("/crm/api/farms/:id/documents", (req, res, next) => {
    Promise.resolve().then(() => canFarm(db, who(req), id(req.params.id))).then(() => next()).catch(next);
  }, upload.single("arquivo"), route(async (req, res) => {
    const fid = id(req.params.id), u = who(req), b = req.body ?? {};
    const categoria = text(b.categoria, 80, true), descricao = text(b.descricao ?? "", 1500), requestKey = uuid(b.request_key);
    const prior = await db.query("SELECT id,fazenda_id FROM crm_documents WHERE criado_por=$1 AND request_key=$2", [u.id, requestKey]);
    if (prior.rowCount) { check(prior.rows[0].fazenda_id === fid, 409, "Requisição já utilizada."); res.status(200).json((await listDocuments(db, fid)).find(d => d.id === prior.rows[0].id)); return; }
    check(req.file && req.file.size > 0, 400, "Escolha um documento.");
    const inspected = inspectDocument(req.file.buffer, req.file.originalname);
    const arquivo = crypto.randomBytes(24).toString("hex") + inspected.ext;
    await fs.mkdir(docsDir, { recursive: true, mode: 0o700 });
    const dest = path.join(docsDir, arquivo);
    await fs.writeFile(dest, inspected.data, { flag: "wx", mode: 0o600 });
    let documentId: number | null = null;
    try {
      documentId = await db.transaction(async tx => {
        await canFarm(tx, u, fid);
        const r = await tx.query(`INSERT INTO crm_documents(fazenda_id,arquivo,nome,mime,categoria,descricao,tamanho,criado_por,request_key)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(criado_por,request_key) DO NOTHING RETURNING id`,
        [fid, arquivo, safeName(req.file!.originalname, inspected.ext), inspected.mime, categoria, descricao, inspected.data.length, u.id, requestKey]);
        if (!r.rowCount) return null;
        await event(tx, u, "Documento anexado", { documento_id: r.rows[0].id, categoria }, null, fid); return r.rows[0].id;
      });
    } catch (e) { await fs.unlink(dest).catch(() => {}); throw e; }
    if (documentId === null) {
      await fs.unlink(dest);
      const p = (await db.query("SELECT id,fazenda_id FROM crm_documents WHERE criado_por=$1 AND request_key=$2", [u.id, requestKey])).rows[0];
      check(p?.fazenda_id === fid, 409, "Requisição já utilizada."); documentId = p.id;
    }
    res.status(201).json((await listDocuments(db, fid)).find(d => d.id === documentId));
  }));
  app.get("/crm/api/documents/:id/download", route(async (req, res) => {
    const d = (await db.query("SELECT * FROM crm_documents WHERE id=$1", [id(req.params.id)])).rows[0];
    check(d, 404, "Documento não encontrado."); await canFarm(db, who(req), d.fazenda_id);
    check(/^[a-f0-9]{48}\.(pdf|jpg|png)$/.test(d.arquivo), 404);
    check(await fs.access(path.join(docsDir, d.arquivo)).then(() => true, () => false), 404, "Arquivo indisponível.");
    await event(db, who(req), "Documento baixado", { documento_id: d.id }, null, d.fazenda_id);
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "private, no-store"); res.type(d.mime);
    res.download(path.join(docsDir, d.arquivo), d.nome);
  }));
  app.delete("/crm/api/documents/:id", route(async (req, res) => {
    const did = id(req.params.id), u = who(req);
    const d = await db.transaction(async tx => {
      const row = (await tx.query("SELECT * FROM crm_documents WHERE id=$1 FOR UPDATE", [did])).rows[0];
      check(row, 404, "Documento não encontrado."); await canFarm(tx, u, row.fazenda_id);
      await tx.query("DELETE FROM crm_documents WHERE id=$1", [did]);
      await event(tx, u, "Documento removido", { documento_id: did }, null, row.fazenda_id); return row;
    });
    // Metadado removido primeiro: mesmo em falha de disco não há acesso por URL.
    check(/^[a-f0-9]{48}\.(pdf|jpg|png)$/.test(d.arquivo), 500);
    await fs.unlink(path.join(docsDir, d.arquivo)).catch(e => { if (e.code !== "ENOENT") throw e; }); res.json({ ok: true });
  }));
}
