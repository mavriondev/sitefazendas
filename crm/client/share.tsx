import { useState } from "react";
import { Download, Link2, Share2 } from "lucide-react";
import { api, type Document, type Farm } from "./api";
import { ErrorBox, useAction } from "./ui";

/* Compartilhamento a partir da ficha da fazenda.
   Os arquivos saem do CRM (com login) direto para o app que o corretor escolher;
   nenhum link público de documento é criado. */

async function fetchFile(url: string, name: string) {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!r.ok) throw new Error("Não foi possível baixar o arquivo. Tente de novo.");
  const blob = await r.blob();
  return new File([blob], name, { type: blob.type || "application/octet-stream" });
}
function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export const canShareFiles = (files: File[]) => typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files });
/** Abre a folha de compartilhamento do celular (WhatsApp, Instagram…). Sem suporte, baixa os arquivos. */
async function shareOrSave(files: File[], title: string) {
  if (canShareFiles(files)) {
    try { await navigator.share({ files, title }); return "shared"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelled"; throw e; }
  }
  for (const f of files) saveFile(f);
  return "saved";
}
const ext = (name: string) => (name.match(/\.(jpg|png)$/i)?.[1] ?? "jpg").toLowerCase();
const photoName = (f: Farm, i: number, arquivo: string) => `${f.slug || "fazenda"}-${String(i + 1).padStart(2, "0")}.${ext(arquivo)}`;
const photoFiles = (f: Farm) => Promise.all(f.fotos.map((p, i) => fetchFile(api.photoUrl(f.id, p.arquivo), photoName(f, i, p.arquivo))));
const supportsShare = () => typeof navigator !== "undefined" && !!navigator.share;

export function PhotosCard({ f }: { f: Farm }) {
  const act = useAction();
  const [note, setNote] = useState("");
  if (!f.fotos.length) return null;
  const run = (mode: "share" | "save") => act.run(async () => {
    setNote("");
    const files = await photoFiles(f);
    if (mode === "save") { files.forEach(saveFile); setNote(`${files.length} foto(s) baixada(s).`); return; }
    const r = await shareOrSave(files, f.titulo);
    if (r === "saved") setNote("Este aparelho não abre o compartilhamento direto; as fotos foram baixadas para você enviar.");
  });
  return (
    <section className="card">
      <div className="card-h">
        <h2>Fotos <span className="tag">{f.fotos.length}</span></h2>
        <div className="row">
          {supportsShare() && <button className="btn sm primary" onClick={() => run("share")} disabled={act.busy} data-testid="button-share-photos"><Share2 size={14} />Compartilhar</button>}
          <button className="btn sm" onClick={() => run("save")} disabled={act.busy} data-testid="button-download-photos"><Download size={14} />{act.busy ? "Preparando…" : "Baixar todas"}</button>
        </div>
      </div>
      <ErrorBox error={act.error} />
      {note && <div className="small muted" style={{ marginBottom: 8 }}>{note}</div>}
      <div className="photos">{f.fotos.map((p, i) => (
        <figure key={p.arquivo}>
          <a href={api.photoUrl(f.id, p.arquivo)} download={photoName(f, i, p.arquivo)} title="Baixar esta foto"><img src={api.photoUrl(f.id, p.arquivo)} alt={p.legenda ?? f.titulo} loading="lazy" /></a>
          {p.legenda && <figcaption>{p.legenda}</figcaption>}
        </figure>
      ))}</div>
    </section>
  );
}

export function ShareDocButton({ d }: { d: Document }) {
  const act = useAction();
  if (!supportsShare()) return null;
  return (
    <button className="btn sm" aria-label="Compartilhar" title="Compartilhar" disabled={act.busy} data-testid={`button-share-doc-${d.id}`}
      onClick={() => act.run(async () => {
        if (!window.confirm("Documentos podem ter CAR, município ou nome do proprietário. Confira antes de enviar. Continuar?")) return;
        await shareOrSave([await fetchFile(api.downloadUrl(d.id), d.nome)], d.nome);
      })}><Share2 size={14} /></button>
  );
}

/** Envia o link público do anúncio (só para fazendas publicadas). */
export function ShareLinkButton({ f, url }: { f: Farm; url: string }) {
  const text = `${f.titulo}${f.area ? ` · ${Number(f.area).toLocaleString("pt-BR")} ha` : ""}`;
  const share = async () => {
    if (supportsShare()) { try { await navigator.share({ title: f.titulo, text, url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener,noreferrer");
  };
  return <button className="btn" onClick={share} data-testid="button-share-link"><Link2 size={15} />Enviar link</button>;
}
