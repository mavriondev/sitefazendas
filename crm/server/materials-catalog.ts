import type { Database } from "./db";
import type { Source } from "./source";
import type { MaterialItem, MaterialsResponse } from "../materials-shared";
import type { User } from "../shared";
import { check, canFarm, Fault } from "./security";
import { openPrivate, privateName, limitsOf, type MaterialsOptions } from "./materials-storage";
import type { OpenMaterial } from "./materials-zip";

export interface MaterialContext extends MaterialsOptions {
  db: Database; source?: Source; siteDocumentsDir?: string; siteUploadsDir?: string; siteUrl: string;
}
export interface ResolvedMaterial extends OpenMaterial {
  key: string; kind: MaterialItem["kind"]; origin: MaterialItem["origin"]; owner?: number; ext: string;
}
export function materialKeys(input: unknown) {
  check(Array.isArray(input) && input.length > 0 && input.length <= 100, 400, "Selecione de 1 a 100 arquivos.");
  check(input.every(k => typeof k === "string" && /^(m:\d{1,12}|d:\d{1,12}|p:[a-f0-9]{32}\.(jpg|png))$/.test(k)), 400, "Seleção inválida.");
  check(new Set(input).size === input.length, 400, "Há arquivos repetidos na seleção.");
  return input as string[];
}
export async function resolveMaterial(o: MaterialContext, fid: number, key: string): Promise<ResolvedMaterial> {
  materialKeys([key]);
  if (key.startsWith("m:")) {
    const m = (await o.db.query("SELECT * FROM crm_materials WHERE id=$1 AND fazenda_id=$2 AND deleted_at IS NULL", [Number(key.slice(2)), fid])).rows[0];
    check(m, 404, "Material indisponível.");
    return { ...await openPrivate(o.dir, m.arquivo, Number(m.tamanho)), name: privateName(m.nome), mime: m.mime, key, ext: m.ext, kind: m.kind, origin: "crm", owner: m.criado_por };
  }
  if (key.startsWith("d:")) {
    check(o.source?.document, 503, "Os documentos do site estão indisponíveis.");
    const d = await o.source.document(Number(key.slice(2))).catch(() => { throw new Fault(503, "Os documentos do site estão indisponíveis."); });
    check(d && d.fazenda_id === fid, 404, "Documento indisponível.");
    const ext = d.arquivo.split(".").pop()!;
    check(["pdf","jpg","png"].includes(ext), 404, "Documento indisponível.");
    return { ...await openPrivate(o.siteDocumentsDir, d.arquivo, Number(d.tamanho)), name: privateName(d.nome), mime: d.mime, key, ext, kind: "documento", origin: "site" };
  }
  const file = key.slice(2);
  const farm = (await o.db.query("SELECT snapshot FROM crm_farms WHERE id=$1", [fid])).rows[0];
  const index = farm?.snapshot.fotos?.findIndex((f: any) => f.arquivo === file) ?? -1;
  check(index >= 0, 404, "Foto indisponível.");
  const ext = file.split(".").pop()!;
  return { ...await openPrivate(o.siteUploadsDir, file), name: `Foto ${index + 1}.${ext}`, mime: ext === "png" ? "image/png" : "image/jpeg", key, ext, kind: "foto", origin: "site" };
}
export async function openSelection(o: MaterialContext, fid: number, keys: string[]) {
  const files: ResolvedMaterial[] = [];
  try {
    for (const k of materialKeys(keys)) files.push(await resolveMaterial(o, fid, k));
    return files;
  } catch (e) { await closeSelection(files); throw e; }
}
export async function closeSelection(files: OpenMaterial[]) { await Promise.all(files.map(f => f.handle.close().catch(() => {}))); }
export function externalName(file: ResolvedMaterial, index: number) {
  const type = file.kind === "foto" ? "Foto" : file.kind === "video" ? "Vídeo" : "Documento";
  return `${type} ${index + 1}.${file.ext}`;
}
export async function catalog(o: MaterialContext, fid: number, user: User): Promise<MaterialsResponse> {
  await canFarm(o.db, user, fid);
  const f = (await o.db.query("SELECT * FROM crm_farms WHERE id=$1", [fid])).rows[0];
  const own = (await o.db.query("SELECT id FROM crm_materials WHERE fazenda_id=$1 AND deleted_at IS NULL ORDER BY criado_em DESC,id DESC LIMIT 500", [fid])).rows;
  const keys = own.map(m => `m:${m.id}`); let warning: string | null = null;
  for (const p of (f.snapshot.fotos ?? [])) keys.push(`p:${p.arquivo}`);
  try {
    check(o.source?.documents, 503);
    for (const d of (await o.source.documents(fid))) keys.push(`d:${d.id}`);
  } catch { warning = "Não foi possível ler os documentos do site agora. Os materiais do CRM continuam disponíveis."; }
  const items: MaterialItem[] = [];
  for (const k of keys) {
    try {
      const m = await resolveMaterial(o, fid, k);
      items.push({ key: k, label: m.name, kind: m.kind, ext: m.ext, size: m.size, origin: m.origin,
        download_url: `/crm/api/farms/${fid}/materials/download?key=${encodeURIComponent(k)}`,
        removable: m.origin === "crm" && (user.papel === "admin" || m.owner === user.id) });
      await m.handle.close();
    } catch { warning = warning ?? "Alguns arquivos estão indisponíveis na pasta de origem; não serão incluídos nos downloads."; }
  }
  return { items, limits: limitsOf(o), warning, enabled: !!o.dir,
    pdf_url: f.disponivel && f.snapshot.status === "publicada" ? `${o.siteUrl}/fazenda/${encodeURIComponent(f.snapshot.slug)}/pdf` : null };
}
