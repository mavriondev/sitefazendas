import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Link2, Share2, X } from "lucide-react";
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

const isIOS = () => typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1));

export function PhotosCard({ f }: { f: Farm }) {
  const act = useAction();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  if (!f.fotos.length) return null;
  const ios = isIOS();
  // iPhone: a folha de compartilhamento tem "Salvar imagens", que grava no app Fotos.
  // Android/computador: o download vai para Downloads, que a Galeria/Google Fotos já mostra.
  const saveToPhone = () => act.run(async () => {
    setNote("");
    const files = await photoFiles(f);
    if (ios && canShareFiles(files)) {
      setNote('Na janela que abriu, toque em "Salvar imagens" para mandar as fotos para o app Fotos.');
      const r = await shareOrSave(files, f.titulo);
      if (r === "cancelled") setNote("");
      return;
    }
    files.forEach(saveFile);
    setNote(`${files.length} foto(s) salva(s) na pasta Downloads. No Android, elas aparecem na Galeria e no Google Fotos.`);
  });
  const share = () => act.run(async () => {
    setNote("");
    const r = await shareOrSave(await photoFiles(f), f.titulo);
    if (r === "saved") setNote("Este aparelho não abre o compartilhamento direto; as fotos foram baixadas para você enviar.");
  });
  return (
    <section className="card">
      <div className="card-h">
        <h2>Fotos <span className="tag">{f.fotos.length}</span></h2>
        <div className="row">
          <button className="btn sm primary" onClick={saveToPhone} disabled={act.busy} data-testid="button-download-photos"><Download size={14} />{act.busy ? "Preparando…" : "Salvar no celular"}</button>
          {supportsShare() && <button className="btn sm" onClick={share} disabled={act.busy} data-testid="button-share-photos"><Share2 size={14} />Compartilhar</button>}
        </div>
      </div>
      <ErrorBox error={act.error} />
      {note && <div className="alert" style={{ marginBottom: 8 }} data-testid="text-photos-note">{note}</div>}
      <div className="photos">{f.fotos.map((p, i) => (
        <figure key={p.arquivo}>
          <button type="button" className="photo-btn" onClick={() => setOpen(i)} aria-label={`Abrir foto ${i + 1}`} data-testid={`button-photo-${i}`}><img src={api.photoUrl(f.id, p.arquivo)} alt={p.legenda ?? f.titulo} loading="lazy" /></button>
          {p.legenda && <figcaption>{p.legenda}</figcaption>}
        </figure>
      ))}</div>
      {open !== null && <Lightbox f={f} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Lightbox({ f, index, onIndex, onClose }: { f: Farm; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const p = f.fotos[index]!; const n = f.fotos.length;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % n);
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
    };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [index, n, onClose, onIndex]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="lightbox">
      <div className="lightbox-top">
        <span>{index + 1} de {n}</span>
        <button className="btn sm" onClick={onClose} aria-label="Fechar" data-testid="button-close-lightbox"><X size={16} /></button>
      </div>
      <img src={api.photoUrl(f.id, p.arquivo)} alt={p.legenda ?? f.titulo} />
      <div className="lightbox-foot">
        {p.legenda && <div>{p.legenda}</div>}
        <div className="small">Segure o dedo na foto e escolha salvar.</div>
        <div className="row" style={{ justifyContent: "center" }}>
          {n > 1 && <button className="btn sm" onClick={() => onIndex((index - 1 + n) % n)} aria-label="Foto anterior"><ChevronLeft size={16} /></button>}
          <a className="btn sm" href={api.photoUrl(f.id, p.arquivo)} download={photoName(f, index, p.arquivo)} data-testid="link-download-photo"><Download size={14} />Baixar</a>
          {n > 1 && <button className="btn sm" onClick={() => onIndex((index + 1) % n)} aria-label="Próxima foto"><ChevronRight size={16} /></button>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Documentos ---------- */
export const CATEGORIAS = ["Matrícula", "Escritura", "CAR", "CCIR", "ITR", "Georreferenciamento", "Mapa", "Laudos", "Outros"];
export function DocsDownloadAll({ docs }: { docs: Document[] }) {
  const act = useAction();
  if (docs.length < 2) return null;
  return (
    <>
      <button className="btn sm" disabled={act.busy} data-testid="button-download-docs"
        onClick={() => act.run(async () => { for (const d of docs) saveFile(await fetchFile(api.downloadUrl(d.id), d.nome)); })}>
        <Download size={14} />{act.busy ? "Baixando…" : "Baixar todos"}
      </button>
      <ErrorBox error={act.error} />
    </>
  );
}
/** Agrupa na ordem das categorias padrão; categorias antigas digitadas à mão vão para o fim, sem perder nada. */
export function groupDocs(docs: Document[]) {
  const norm = (c: string) => CATEGORIAS.find((k) => k.localeCompare(c.trim(), "pt-BR", { sensitivity: "base" }) === 0) ?? c.trim();
  const map = new Map<string, Document[]>();
  for (const d of docs) { const k = norm(d.categoria) || "Outros"; map.set(k, [...(map.get(k) ?? []), d]); }
  const rank = (k: string) => { const i = CATEGORIAS.indexOf(k); return i < 0 ? CATEGORIAS.length - 1 : i; };
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], "pt-BR"));
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

/** Lista de documentos só para baixar (sem editar nem remover). */
export function DocsReadOnly({ docs }: { docs: Document[] }) {
  if (!docs.length) return <div className="muted small">Nenhum documento enviado para esta fazenda.</div>;
  return (
    <div className="list">{groupDocs(docs).map(([cat, list]) => (
      <div key={cat}>
        <div className="doc-group">{cat} · {list.length}</div>
        {list.map((d) => (
          <div className="item" key={d.id} data-testid={`row-material-doc-${d.id}`}>
            <div className="item-main"><div className="item-title">{d.nome}</div>{d.descricao && <div className="item-sub">{d.descricao}</div>}</div>
            <a className="btn sm" href={api.downloadUrl(d.id)} download={d.nome} data-testid={`link-material-doc-${d.id}`}><Download size={14} />Baixar</a>
            <ShareDocButton d={d} />
          </div>
        ))}
      </div>
    ))}</div>
  );
}
