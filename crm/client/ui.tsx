import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { ROTULOS, type Event as Ev, type User, type Etapa } from "./api";

/* ---------- auth ---------- */
export const AuthCtx = createContext<{ user: User; setUser: (u: User | null) => void } | null>(null);
export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("AuthCtx ausente");
  return c;
}

/* ---------- dirty guard ---------- */
const dirtyForms = new Set<symbol>();
export function isDirty() { return dirtyForms.size > 0; }
export function confirmLeave() { return !isDirty() || window.confirm("Há alterações não salvas. Sair mesmo assim?"); }
export function useDirty(dirty: boolean) {
  const token = useRef(Symbol("form"));
  useEffect(() => {
    if (!dirty) return;
    dirtyForms.add(token.current);
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => { dirtyForms.delete(token.current); window.removeEventListener("beforeunload", h); };
  }, [dirty]);
}
export function resetDirty() { dirtyForms.clear(); }

/* ---------- data loading ---------- */
export type ApiError = Error & { status?: number; duplicates?: Array<{ id: number; nome: string }> };
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn); fnRef.current = fn;
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const s = ++seq.current;
    setLoading(true);
    try { const d = await fnRef.current(); if (s === seq.current) { setData(d); setError(null); } }
    catch (e) { if (s === seq.current) { const err = e as ApiError; setError(err); if ([401, 403, 404].includes(err.status ?? 0)) setData(null); } }
    finally { if (s === seq.current) setLoading(false); }
  }, []);
  useEffect(() => { setData(null); reload(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => { if (document.visibilityState === "visible" && !isDirty()) reload(); };
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
  }, [reload]);
  return { data, error, loading, reload };
}

/** Prevents double-submits with a ref; surfaces errors. */
export function useAction() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true; setBusy(true); setError(null);
    try { return await fn(); }
    catch (e) { setError(e as ApiError); return undefined; }
    finally { busyRef.current = false; setBusy(false); }
  }, []);
  return { busy, error, setError, run };
}

/* ---------- formatting ---------- */
export const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (s: string | null | undefined) => s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtSize = (n: number) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
export const digits = (s: string) => s.replace(/\D/g, "");
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
export function waLink(tel: string, msg: string) {
  let d = digits(tel);
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
}
export function dayDiff(iso: string) {
  const a = new Date(iso); const b = new Date();
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da - db) / 86400000);
}
export function retornoLabel(iso: string | null) {
  if (!iso) return null;
  const d = dayDiff(iso);
  if (d < 0) return { text: `Atrasado ${-d} d`, cls: "bad" };
  if (d === 0) return { text: "Retorno hoje", cls: "warn" };
  if (d === 1) return { text: "Amanhã", cls: "warn" };
  return { text: fmtDate(iso), cls: "" };
}
export const pdfUrl = (site: string, slug: string) => `${site.replace(/\/$/, "")}/fazenda/${slug}/pdf`;
export const publicUrl = (site: string, slug: string) => `${site.replace(/\/$/, "")}/fazenda/${slug}`;

/* ---------- components ---------- */
export function EtapaTag({ e }: { e: Etapa }) { return <span className={`tag e-${e}`}>{ROTULOS[e] ?? e}</span>; }
export function RetornoTag({ iso }: { iso: string | null }) {
  const r = retornoLabel(iso);
  return r ? <span className={`tag ${r.cls}`}>{r.text}</span> : null;
}

export function ErrorBox({ error, retry }: { error: ApiError | null; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="alert bad" role="alert" data-testid="status-error">
      <AlertTriangle size={17} />
      <div style={{ flex: 1 }}>{error.message}</div>
      {retry && <button className="btn sm" onClick={retry} data-testid="button-retry"><RefreshCw size={14} />Tentar de novo</button>}
    </div>
  );
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="stack" aria-busy="true">{Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ height: 54 }} />)}</div>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children && <div className="small">{children}</div>}</div>;
}
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const box = boxRef.current!;
    const items = () => Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const first = items().find((el) => !el.matches("[data-modal-close]")) ?? box;
    first.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) { e.preventDefault(); box.focus(); return; }
      const a = list[0]!, z = list[list.length - 1]!;
      const cur = document.activeElement;
      if (e.shiftKey && (cur === a || !box.contains(cur))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (cur === z || !box.contains(cur))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", h);
    return () => { document.removeEventListener("keydown", h); if (prev && document.contains(prev)) prev.focus(); };
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={boxRef} tabIndex={-1}>
        <div className="card-h" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar" data-modal-close data-testid="button-close-modal"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ACOES: Record<string, string> = {
  criado: "Criado", atualizado: "Atualizado", removido: "Removido", contato_criado: "Contato criado", contato_atualizado: "Contato atualizado",
  negociacao_criada: "Negociação criada", negociacao_atualizada: "Negociação atualizada", documento_enviado: "Documento enviado",
  documento_removido: "Documento removido", importado: "Importado",
};
const label = (k: string) => ACOES[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");
function detail(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return ROTULOS[v as Etapa] ?? v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return "[valor]"; }
}
export function History({ events }: { events: Ev[] }) {
  if (!events.length) return <Empty title="Sem histórico ainda">As alterações aparecem aqui assim que alguém da equipe registrar algo.</Empty>;
  return (
    <div className="timeline">
      {events.map((e) => {
        const entries = e.detalhes && typeof e.detalhes === "object" ? Object.entries(e.detalhes) : [];
        return (
          <div className="ev" key={e.id} data-testid={`event-${e.id}`}>
            <div style={{ minWidth: 0 }}>
              <div><strong>{label(e.acao)}</strong> <span className="muted small">· {e.autor_nome} · {fmtDateTime(e.criado_em)}</span></div>
              {entries.length > 0 && <div className="ev-d">{entries.map(([k, v]) => `${label(k)}: ${detail(v)}`).join("\n")}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
