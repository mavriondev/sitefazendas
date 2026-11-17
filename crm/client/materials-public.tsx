import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, Download, FileText, Film, Image as ImageIcon, Package, RefreshCw } from "lucide-react";
import { fetchPublic, type PublicErr, type PublicMaterials } from "./materials-api";
import "./styles.css";
import "./materiais.css";

const KIND = { foto: "Foto", video: "Vídeo", documento: "Documento" } as const;
const size = (n: number) => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace(".", ",")} MB`;
const when = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const MSG: Record<PublicErr["kind"] | "missing", [string, string]> = {
  missing: ["Link incompleto", "O endereço recebido não traz a chave de acesso. Peça um novo link a quem enviou."],
  invalid: ["Link inválido ou encerrado", "Este link não existe, expirou ou foi revogado. Peça um novo a quem enviou."],
  expired: ["Link expirado", "O prazo deste link terminou. Peça um novo a quem enviou."],
  unavailable: ["Materiais indisponíveis", "Não foi possível abrir os arquivos agora. Tente de novo em alguns minutos."],
  network: ["Sem conexão", "Verifique a internet e tente de novo."],
};

/** Aceita só o formato emitido pelo servidor (64 hex); qualquer outra coisa vira "inválido", sem exceção. */
function readToken(): { token: string; bad: boolean } {
  const h = window.location.hash.replace(/^#/, "").trim();
  if (!h) return { token: "", bad: false };
  return /^[0-9a-f]{64}$/i.test(h) ? { token: h.toLowerCase(), bad: false } : { token: "", bad: true };
}

function submitDownload(token: string, field: ["item", string] | ["all", "1"]) {
  const f = document.createElement("form");
  f.method = "POST"; f.action = "/crm/shared-api/download"; f.target = "_blank"; f.rel = "noopener noreferrer"; f.style.display = "none";
  for (const [n, v] of [["token", token], field]) { const i = document.createElement("input"); i.type = "hidden"; i.name = n; i.value = v; f.appendChild(i); }
  document.body.appendChild(f); f.submit(); f.remove();
}

function Page() {
  const first = useRef(readToken());
  const tokenRef = useRef(first.current.token);
  const [data, setData] = useState<PublicMaterials | null>(null);
  const [err, setErr] = useState<PublicErr["kind"] | "missing" | null>(tokenRef.current ? null : first.current.bad ? "invalid" : "missing");
  const [loading, setLoading] = useState(!!tokenRef.current);
  const [busy, setBusy] = useState<string | null>(null);
  const [inline, setInline] = useState<string>("");

  const load = useCallback(async () => {
    if (!tokenRef.current) return;
    setLoading(true); setErr(null);
    try { setData(await fetchPublic(tokenRef.current)); }
    catch (e) { setData(null); setErr((e as PublicErr).kind ?? "unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => { const t = readToken(); tokenRef.current = t.token; setData(null); if (!t.token) { setLoading(false); setErr(t.bad ? "invalid" : "missing"); } else load(); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, [load]);

  const download = async (id: string, field: ["item", string] | ["all", "1"]) => {
    if (busy) return;
    setBusy(id); setInline("");
    try {
      const fresh = await fetchPublic(tokenRef.current);
      setData(fresh);
      submitDownload(tokenRef.current, field);
    } catch (e) {
      const k = (e as PublicErr).kind ?? "unavailable";
      setInline(MSG[k][1]);
      if (k === "expired" || k === "invalid") { setData(null); setErr(k); }
    } finally { setBusy(null); }
  };

  const total = data?.items.reduce((s, i) => s + i.size, 0) ?? 0;
  return (
    <div className="pub">
      <header className="pub-top"><div className="k">Materiais compartilhados</div></header>
      <main className="pub-main" aria-busy={loading}>
        {loading && !data ? (
          <div className="stack" aria-label="Carregando">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 58 }} />)}</div>
        ) : err ? (
          <div className="empty" role="alert" data-testid="status-public-error">
            <AlertTriangle size={26} className="muted" />
            <h3>{MSG[err][0]}</h3>
            <div className="small">{MSG[err][1]}</div>
            {(err === "unavailable" || err === "network") && <button className="btn sm" style={{ marginTop: 14 }} onClick={load} data-testid="button-public-retry"><RefreshCw size={14} />Tentar de novo</button>}
          </div>
        ) : data && (
          <>
            <div>
              <h1 data-testid="text-public-title">{data.title}</h1>
              <div className="muted small" style={{ marginTop: 6 }} data-testid="text-public-expires">Disponível até {when(data.expires_at)}</div>
            </div>
            {inline && <div className="alert bad" role="alert"><AlertTriangle size={17} />{inline}</div>}
            {data.items.length === 0 ? (
              <div className="empty"><h3>Nenhum arquivo</h3><div className="small">Este link não tem mais arquivos disponíveis.</div></div>
            ) : (
              <section className="card mat">
                <div className="mat-head">
                  <div className="small muted">{data.items.length} arquivo{data.items.length > 1 ? "s" : ""} · {size(total)}</div>
                  {data.items.length > 1 && <div className="row"><button className="btn primary" onClick={() => download("all", ["all", "1"])} disabled={!!busy} data-testid="button-public-download-all"><Package size={16} />{busy === "all" ? "Verificando…" : "Baixar tudo"}</button></div>}
                </div>
                <div className="mat-list" role="list">
                  {data.items.map((it) => {
                    const I = it.kind === "foto" ? ImageIcon : it.kind === "video" ? Film : FileText;
                    return (
                      <div className="mat-row" style={{ gridTemplateColumns: "40px minmax(0,1fr) auto" }} role="listitem" key={it.id} data-testid={`row-public-item-${it.id}`}>
                        <span className={`mat-ico ${it.kind}`} aria-hidden="true" style={{ display: "grid" }}><I size={18} /></span>
                        <div style={{ minWidth: 0 }}><div className="mat-name">{it.label}</div><div className="mat-meta"><span>{KIND[it.kind]}</span><span>{size(it.size)}</span></div></div>
                        <button className="btn sm" onClick={() => download(String(it.id), ["item", String(it.id)])} disabled={!!busy} aria-label={`Baixar ${it.label}`} data-testid={`button-public-download-${it.id}`}><Download size={14} />{busy === String(it.id) ? "…" : "Baixar"}</button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <footer className="pub-foot">Acesso temporário. Não repasse este endereço.</footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Page /></StrictMode>);
