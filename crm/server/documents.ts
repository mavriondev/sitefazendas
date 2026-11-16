import type { Express } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import type { Database } from "./db";
import type { Source, SiteDoc } from "./source";
import { asyncRoute as route, who, canFarm, check, id, event, Fault } from "./security";
import { NOME_ARQUIVO_DOCUMENTO } from "../../shared/documentos";

// Os documentos são cadastrados no painel do site. Aqui só há leitura: listar e baixar.
const publico = ({ arquivo: _arquivo, mime: _mime, ...d }: SiteDoc) => d;
/** Lista ao vivo. Falha da origem não derruba a ficha: devolve vazio e sinaliza o erro. */
export async function listDocuments(source: Source | undefined, farmId: number) {
  try { check(source, 503); return { documentos: (await source.documents(farmId)).map(publico), erro: false }; }
  catch { return { documentos: [], erro: true }; }
}
export function documentRoutes(app: Express, db: Database, source: Source | undefined, siteDocsDir: string | undefined) {
  app.get("/crm/api/documents/:id/download", route(async (req, res) => {
    check(source, 503, "A origem do site está indisponível.");
    const d = await source.document(id(req.params.id)).catch(() => { throw new Fault(503, "A origem do site está indisponível. Tente de novo em instantes."); });
    check(d, 404, "Documento não encontrado.");
    await canFarm(db, who(req), d.fazenda_id);
    check(NOME_ARQUIVO_DOCUMENTO.test(d.arquivo) && siteDocsDir, 404, "Arquivo indisponível.");
    const file = path.resolve(siteDocsDir, d.arquivo);
    check(file.startsWith(path.resolve(siteDocsDir) + path.sep) && await fs.access(file).then(() => true, () => false), 404, "Arquivo indisponível.");
    await event(db, who(req), "Documento baixado", { documento_id: d.id }, null, d.fazenda_id);
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "private, no-store"); res.type(d.mime);
    res.download(file, d.nome);
  }));
}
