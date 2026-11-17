import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { MaterialLimits } from "../materials-shared";
import { check, Fault } from "./security";

export const MiB = 1024 * 1024;
export const DEFAULT_LIMITS: MaterialLimits = { video_bytes: 250 * MiB, file_bytes: 12 * MiB, zip_bytes: 1024 * MiB, max_items: 100 };
export interface MaterialsOptions {
  dir?: string;
  limits?: MaterialLimits;
  farmQuota?: number;
}
export const limitsOf = (o: MaterialsOptions): MaterialLimits => ({ ...DEFAULT_LIMITS, ...o.limits });
export function numberSetting(value: string | undefined, fallback: number, max: number) {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  check(Number.isSafeInteger(n) && n > 0 && n <= max, 500, "Limite privado de materiais inválido.");
  return n;
}
export function separateDirectory(dir: string | undefined, protectedDirs: Array<string | undefined>) {
  if (!dir) return;
  const d = path.resolve(dir);
  for (const p of protectedDirs.filter(Boolean) as string[]) {
    const other = path.resolve(p);
    check(d !== other && !d.startsWith(other + path.sep) && !other.startsWith(d + path.sep), 500,
      "Materiais do CRM exigem uma pasta privada separada das pastas do site.");
  }
}
export async function privateRoot(dir: string, create = false) {
  const root = path.resolve(dir);
  if (create) await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const st = await fs.lstat(root);
  check(st.isDirectory() && !st.isSymbolicLink() && !(st.mode & 0o022), 503, "Pasta privada de materiais indisponível.");
  check(await fs.realpath(root) === root, 503, "A pasta de materiais não pode atravessar links simbólicos.");
  return root;
}
export async function openPrivate(dir: string | undefined, filename: string, expectedSize?: number) {
  check(dir && /^[a-f0-9]{32,48}\.(mp4|mov|webm|pdf|jpg|png)$/.test(filename), 404, "Arquivo indisponível.");
  const root = path.resolve(dir);
  check(await fs.realpath(root).catch(() => "") === root, 503, "Pasta de arquivos indisponível.");
  const handle = await fs.open(path.join(root, filename), constants.O_RDONLY | constants.O_NOFOLLOW)
    .catch(() => { throw new Fault(404,"Arquivo indisponível."); });
  try {
    const stat = await handle.stat();
    check(stat.isFile() && stat.size > 0 && (expectedSize === undefined || stat.size === expectedSize), 503, "Arquivo indisponível ou incompleto.");
    return { handle, size: stat.size };
  } catch (e) { await handle.close(); throw e; }
}
export function privateName(original: string) {
  return path.basename(original.replace(/\\/g, "/")).normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").slice(0, 150).trim() || "arquivo";
}
export async function inspectMaterial(file: string, original: string) {
  const ext = path.extname(original).toLowerCase().slice(1).replace("jpeg", "jpg");
  check(["pdf", "jpg", "png", "mp4", "mov", "webm"].includes(ext), 415, "Use PDF, JPEG, PNG, MP4, MOV ou WebM.");
  const h = await fs.open(file, "r");
  try {
    const st = await h.stat(), head = Buffer.alloc(Math.min(st.size, 4096)), tail = Buffer.alloc(Math.min(st.size, 1024));
    check(st.size > 0, 415, "Arquivo vazio.");
    await h.read(head, 0, head.length, 0); await h.read(tail, 0, tail.length, st.size - tail.length);
    let ok = false;
    if (ext === "pdf") ok = head.subarray(0, 5).toString() === "%PDF-" && tail.includes(Buffer.from("%%EOF"));
    if (ext === "jpg") ok = head[0] === 255 && head[1] === 216 && tail.at(-2) === 255 && tail.at(-1) === 217;
    if (ext === "png") ok = head.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && tail.subarray(-8,-4).toString() === "IEND";
    if (ext === "webm") ok = head.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])) && head.includes(Buffer.from("webm"));
    if (ext === "mp4" || ext === "mov") {
      let offset = 0, boxes = 0, ftyp = false, media = false, movie = false;
      while (offset < st.size && boxes++ < 100000) {
        const b = Buffer.alloc(16);
        const r = await h.read(b, 0, Math.min(16, st.size - offset), offset);
        if (r.bytesRead < 8) break;
        let size = b.readUInt32BE(0); const kind = b.toString("ascii", 4, 8);
        if (size === 1) { if (r.bytesRead < 16) break; const big = b.readBigUInt64BE(8); if (big > BigInt(Number.MAX_SAFE_INTEGER)) break; size = Number(big); }
        else if (size === 0) size = st.size - offset;
        if (size < (b.readUInt32BE(0) === 1 ? 16 : 8) || offset + size > st.size) break;
        if (offset === 0) ftyp = kind === "ftyp" && size >= 16;
        if (kind === "mdat" && size > 8) media = true;
        if (kind === "moov" && size > 8) movie = true;
        offset += size;
      }
      ok = offset === st.size && ftyp && media && movie;
    }
    check(ok, 415, "O conteúdo não corresponde ao formato ou o arquivo está incompleto.");
    return { ext, mime: ({ pdf:"application/pdf", jpg:"image/jpeg", png:"image/png", mp4:"video/mp4", mov:"video/quicktime", webm:"video/webm" } as Record<string,string>)[ext],
      kind: (["mp4","mov","webm"].includes(ext) ? "video" : ext === "pdf" ? "documento" : "foto") as "video" | "documento" | "foto" };
  } finally { await h.close(); }
}
