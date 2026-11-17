import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Check, Copy, Download, ExternalLink, FileText, Film, Image as ImageIcon, Link2, Lock, Package, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { key } from "./api";
import { materialsApi, nativeDownload, uploadMaterial, type MaterialItem, type MaterialShare, type MaterialsResponse, type UploadHandle } from "./materials-api";
import { Empty, ErrorBox, Modal, Skeleton, fmtDateTime, fmtSize, useAction, useDirty, useLoad, type ApiError } from "./ui";
import "./materiais.css";

type Filtro = "todos" | MaterialItem["kind"];
const KIND: Record<MaterialItem["kind"], string> = { foto: "Foto", video: "Vídeo", documento: "Documento" };
const KIND_PL: Record<Filtro, string> = { todos: "Todos", foto: "Fotos", video: "Vídeos", documento: "Documentos" };
function KindIcon({ k }: { k: MaterialItem["kind"] }) {
  const I = k === "foto" ? ImageIcon : k === "video" ? Film : FileText;
  return <span className={`mat-ico ${k}`} aria-hidden="true"><I size={18} /></span>;
}

export function MaterialsPanel({ farmId }: { farmId: number }) {
  const q = useLoad(() => materialsApi.list(farmId), [farmId]);
  const shares = useLoad(() => materialsApi.shares(farmId), [farmId]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [sel, setSel] = useState<string[]>([]);
  const [modal, setModal] = useState<"upload" | "share" | null>(null);
  const [ok, setOk] = useState("");
  const [removeWarning,setRemoveWarning]=useState("");
  const del = useAction();
  useDirty(sel.length > 0);

  const items = q.data?.items ?? [];
  const valid = useMemo(() => new Set(items.map((i) => i.key)), [items]);
  const selected = useMemo(() => items.filter((i) => sel.includes(i.key)), [items, sel]);
  const visible = filtro === "todos" ? items : items.filter((i) => i.kind === filtro);
  const counts = useMemo(() => {
    const c: Record<Filtro, number> = { todos: items.length, foto: 0, video: 0, documento: 0 };
    items.forEach((i) => { c[i.kind]++; });
    return c;
  }, [items]);
  const total = selected.reduce((s, i) => s + i.size, 0);
  const lim = q.data?.limits;
  const zipBlock = lim ? (selected.length > lim.max_items ? `Máximo de ${lim.max_items} arquivos por pacote.` : total > lim.zip_bytes ? `O pacote passa de ${fmtSize(lim.zip_bytes)}. Desmarque alguns arquivos.` : "") : "";

  const toggle = (k: string) => { setOk(""); setSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]); };
  const allVisibleOn = visible.length > 0 && visible.every((i) => sel.includes(i.key));
  const toggleVisible = () => setSel((s) => allVisibleOn ? s.filter((k) => !visible.some((i) => i.key === k)) : [...new Set([...s, ...visible.map((i) => i.key)])]);
  const clear = () => setSel([]);

  const remove = async (it: MaterialItem) => {
    if (!it.removable) return;
    if (!window.confirm(`Remover "${it.label}" da central? Links já emitidos deixam de entregar este arquivo.`)) return;
    setOk("");setRemoveWarning("");
    const r = await del.run(() => materialsApi.remove(farmId, it.key));
    if (r) { setSel((s) => s.filter((k) => k !== it.key)); setOk(`"${it.label}" foi removido.`);setRemoveWarning(r.warning??""); q.reload(); shares.reload(); }
  };

  if (q.loading && !q.data) return <section className="card"><Skeleton rows={4} /></section>;
  if (!q.data) return <section className="card"><ErrorBox error={q.error} retry={q.reload} /></section>;
  const d = q.data;

  return (
    <div className="stack">
      <section className="card mat" aria-labelledby="mat-title" data-testid="panel-materials">
        <div className="mat-head">
          <div>
            <h2 id="mat-title">Materiais <span className="tag">{items.length}</span></h2>
            <p className="small muted">Fotos e documentos do site ficam só para leitura. Os vídeos e arquivos enviados pela equipe podem ser removidos aqui.</p>
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => { setOk(""); setModal("upload"); }} disabled={!d.enabled} data-testid="button-upload-material"><Upload size={16} />Enviar arquivo</button>
          </div>
        </div>

        {!d.enabled && <div className="alert warn" role="status" data-testid="status-storage-disabled"><Lock size={17} /><div>O armazenamento de arquivos não está configurado neste servidor, então não é possível enviar novos materiais. Os arquivos já existentes continuam disponíveis para baixar.</div></div>}
        {d.warning && <div className="alert warn" role="status" data-testid="status-materials-warning"><AlertTriangle size={17} /><div>{d.warning}</div></div>}
        {removeWarning&&<div className="alert warn" role="status">{removeWarning}</div>}
        {ok && <div className="alert ok" role="status" data-testid="status-materials-ok"><ShieldCheck size={17} />{ok}</div>}
        <ErrorBox error={del.error} />
        <ErrorBox error={q.error} retry={q.reload} />

        {d.pdf_url && (
          <div className="mat-pdf" data-testid="box-farm-pdf">
            <FileText size={20} className="muted" />
            <div><strong>Ficha da fazenda</strong><div className="small muted">Para incluir a ficha no pacote, salve como PDF e envie o arquivo.</div></div>
            <a className="btn sm" href={d.pdf_url} target="_blank" rel="noopener noreferrer" data-testid="link-materials-pdf"><ExternalLink size={14} />Abrir ficha</a>
          </div>
        )}

        {items.length > 0 && (
          <div className="mat-filters" role="group" aria-label="Filtrar por tipo">
            {(Object.keys(KIND_PL) as Filtro[]).filter((f) => f === "todos" || counts[f] > 0).map((f) => (
              <button key={f} className={`chip ${filtro === f ? "on" : ""}`} aria-pressed={filtro === f} onClick={() => setFiltro(f)} data-testid={`chip-materials-${f}`}>{KIND_PL[f]} · {counts[f]}</button>
            ))}
            <button className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={toggleVisible} data-testid="button-select-visible">{allVisibleOn ? "Desmarcar estes" : "Marcar estes"}</button>
          </div>
        )}

        {items.length === 0 ? (
          <Empty title="Nenhum material ainda">{d.enabled ? "Envie vídeos, plantas ou a ficha salva em PDF para tê-los à mão no atendimento." : "Quando o site tiver fotos ou documentos desta fazenda, eles aparecem aqui."}</Empty>
        ) : (
          <div className="mat-list" role="list">
            {visible.map((it) => {
              const on = sel.includes(it.key);
              return (
                <div className={`mat-row ${on ? "on" : ""}`} role="listitem" key={it.key} data-testid={`row-material-${it.key}`}>
                  <label className="mat-check" title={on ? "Desmarcar" : "Selecionar"}>
                    <input type="checkbox" checked={on} onChange={() => toggle(it.key)} aria-label={`Selecionar ${it.label}`} data-testid={`checkbox-material-${it.key}`} />
                  </label>
                  <KindIcon k={it.kind} />
                  <div style={{ minWidth: 0 }}>
                    <div className="mat-name">{it.label}</div>
                    <div className="mat-meta">
                      <span>{KIND[it.kind]}{it.ext ? ` · ${it.ext.replace(/^\./, "").toUpperCase()}` : ""}</span>
                      <span>{fmtSize(it.size)}</span>
                      {it.origin === "site" ? <span className="tag">Site · leitura</span> : <span className="tag ok">Equipe</span>}
                    </div>
                  </div>
                  <div className="mat-acts">
                    <a className="icon-btn" href={it.download_url || materialsApi.downloadUrl(farmId, it.key)} download aria-label={`Baixar ${it.label}`} title="Baixar" data-testid={`link-download-material-${it.key}`}><Download size={17} /></a>
                    {it.removable && <button className="icon-btn danger" onClick={() => remove(it)} disabled={del.busy} aria-label={`Remover ${it.label}`} title="Remover" data-testid={`button-remove-material-${it.key}`}><Trash2 size={17} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selected.length > 0 && (
          <div className="mat-bar" role="region" aria-label="Seleção" data-testid="bar-selection">
            <div><b>{selected.length}</b> selecionado{selected.length > 1 ? "s" : ""} · {fmtSize(total)}</div>
            <div className="row">
              <button className="btn sm" onClick={clear} data-testid="button-clear-selection"><X size={14} />Limpar</button>
              <button className="btn sm" disabled={!!zipBlock} onClick={() => nativeDownload(materialsApi.zipUrl(farmId, selected.map((i) => i.key)))} data-testid="button-download-zip"><Package size={14} />Baixar ZIP</button>
              <button className="btn sm primary" disabled={!!zipBlock} onClick={() => { setOk(""); setModal("share"); }} data-testid="button-open-share"><Link2 size={14} />Criar link</button>
            </div>
            {zipBlock && <div className="hint" role="status">{zipBlock}</div>}
          </div>
        )}
      </section>

      <SharesCard farmId={farmId} q={shares} />

      {modal === "upload" && <UploadModal farmId={farmId} data={d} onClose={() => setModal(null)} onDone={(name) => { setModal(null); setOk(`"${name}" foi enviado.`); q.reload(); }} />}
      {modal === "share" && <ShareModal farmId={farmId} items={selected.filter((i) => valid.has(i.key))} onClose={() => setModal(null)} onCreated={() => { clear(); shares.reload(); }} onListRefresh={shares.reload} />}
    </div>
  );
}

/* ---------- envio ---------- */
function UploadModal({ farmId, data, onClose, onDone }: { farmId: number; data: MaterialsResponse; onClose: () => void; onDone: (name: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const busyRef = useRef(false);
  const handle = useRef<UploadHandle | null>(null);
  const keys = useRef(new Map<string, string>());
  const clearDirty = useDirty(!!file);

  const isVideo = (f: File) => /^video\/(mp4|quicktime|webm)$/.test(f.type) || /\.(mp4|mov|webm)$/i.test(f.name);
  const okType = (f: File) => /\.(pdf|jpe?g|png|mp4|mov|webm)$/i.test(f.name);
  const badType = !!file && !okType(file);
  const max = file ? (isVideo(file) ? data.limits.video_bytes : data.limits.file_bytes) : 0;
  const tooBig = !!file && !badType && file.size > max;

  const pick = (f: File | null) => { if (busyRef.current) return; setFile(f); setError(null); setProgress(0); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || tooBig || badType || busyRef.current || !data.enabled) return;
    busyRef.current = true; setBusy(true); setError(null); setProgress(0);
    const id = `${file.name}|${file.size}|${file.lastModified}`;
    let rk = keys.current.get(id);
    if (!rk) { rk = key(); keys.current.set(id, rk); }
    const h = uploadMaterial(farmId, file, rk, setProgress);
    handle.current = h;
    try { await h.promise; keys.current.delete(id); clearDirty(); onDone(file.name); }
    catch (err) { const ex = err as ApiError & { aborted?: boolean }; setError(ex.aborted ? null : ex); if (ex.aborted) setProgress(0); }
    finally { busyRef.current = false; setBusy(false); handle.current = null; }
  };
  const cancel = () => handle.current?.abort();
  const close = () => {
    if (busyRef.current) { if (!window.confirm("Cancelar o envio em andamento?")) return; cancel(); }
    else if (file && !window.confirm("Descartar o arquivo escolhido?")) return;
    clearDirty(); onClose();
  };
  const pct = Math.round(progress * 100);

  return (
    <Modal title="Enviar arquivo" onClose={close}>
      <form className="form" onSubmit={submit}>
        <label className="drop" data-testid="dropzone-material">
          <Upload size={22} className="muted" />
          <strong>{file ? "Trocar arquivo" : "Escolher arquivo"}</strong>
          <span className="small muted">PDF, JPEG, PNG, MP4, MOV ou WebM</span>
          <span className="small muted">Vídeos até {fmtSize(data.limits.video_bytes)} · demais arquivos até {fmtSize(data.limits.file_bytes)}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.mp4,.mov,.webm,application/pdf,image/jpeg,image/png,video/mp4,video/quicktime,video/webm" disabled={busy} onChange={(e) => pick(e.target.files?.[0] ?? null)} data-testid="input-material-file" />
        </label>
        {file && (
          <div className="file-chip" data-testid="text-material-file">
            {isVideo(file) ? <Film size={18} /> : <FileText size={18} />}
            <div><strong>{file.name}</strong><div className="small muted">{fmtSize(file.size)}</div></div>
            {!busy && <button type="button" className="btn ghost sm" onClick={() => pick(null)} aria-label="Remover arquivo escolhido" data-testid="button-clear-file"><X size={15} /></button>}
          </div>
        )}
        {badType && <div className="alert bad" role="alert"><AlertTriangle size={17} />Formato não aceito. Use PDF, JPEG, PNG, MP4, MOV ou WebM.</div>}
        {tooBig && <div className="alert bad" role="alert"><AlertTriangle size={17} />Este arquivo passa do limite de {fmtSize(max)}.</div>}
        {(busy || progress > 0) && (
          <div className="stack" style={{ gap: 6 }} aria-live="polite">
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso do envio"><i style={{ transform: `scaleX(${progress})` }} /></div>
            <div className="small muted" data-testid="text-upload-progress">{pct >= 100 ? "Finalizando no servidor…" : `Enviando… ${pct}%`}</div>
          </div>
        )}
        {error && <ErrorBox error={error} />}
        {error && <div className="small muted">Ao tentar de novo, o mesmo envio é reaproveitado; não cria cópia duplicada.</div>}
        <div className="modal-foot">
          {busy ? <button type="button" className="btn danger" onClick={cancel} data-testid="button-cancel-upload"><Ban size={15} />Cancelar envio</button>
            : <button type="button" className="btn" onClick={close}>Fechar</button>}
          <button className="btn primary" disabled={!file || tooBig || badType || busy || !data.enabled} data-testid="button-submit-upload">{busy ? "Enviando…" : error ? "Tentar de novo" : "Enviar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- link de compartilhamento ---------- */
function ShareModal({ farmId, items, onClose, onCreated, onListRefresh }: { farmId: number; items: MaterialItem[]; onClose: () => void; onCreated: () => void; onListRefresh: () => void }) {
  const [days, setDays] = useState("7");
  const [reviewed, setReviewed] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [expires, setExpires] = useState("");
  const [copied, setCopied] = useState(false);
  // A chave acompanha o conteúdo do pedido: retry idêntico reaproveita; mudar a validade gera outra.
  const reqKey = useRef<{ sig: string; key: string } | null>(null);
  const act = useAction();
  const n = Number(days);
  const daysOk = Number.isInteger(n) && n >= 1 && n <= 30;
  const hasDocs = items.some((i) => i.kind === "documento");
  const edited = !url && (reviewed || days !== "7");
  const clearDirty = useDirty(edited);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewed || !daysOk || !items.length || url) return;
    const keys = items.map((i) => i.key);
    const sig = JSON.stringify([keys, n]);
    if (!reqKey.current || reqKey.current.sig !== sig) reqKey.current = { sig, key: key() };
    const rk = reqKey.current.key;
    const r = await act.run(async () => {
      try { return await materialsApi.createShare(farmId, { keys, days: n, reviewed: true, request_key: rk }); }
      catch (e) {
        const ex = e as ApiError;
        if (!ex.status) throw Object.assign(new Error("A conexão falhou e não sabemos se o link foi criado. Confira a lista de links emitidos: se aparecer um novo, revogue-o antes de criar outro, pois o endereço não pode ser recuperado. Tentar de novo sem mudar nada é seguro."), { status: 0 });
        throw ex;
      }
    });
    if (!r) onListRefresh();
    if (r) { reqKey.current = null; clearDirty(); setUrl(location.origin + r.path); setExpires(r.link.expires_at); onCreated(); }
  };
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { act.setError(new Error("Não foi possível copiar automaticamente. Selecione o endereço e copie.")); }
  };
  const close = () => {
    if (act.busy) return;
    if (url && !window.confirm("O endereço não poderá ser exibido de novo. Já copiou?")) return;
    if (edited && !window.confirm("Descartar o formulário do link?")) return;
    clearDirty(); onClose();
  };

  return (
    <Modal title={url ? "Link criado" : "Criar link de acesso"} onClose={close}>
      {url ? (
        <div className="form">
          <div className="alert ok" role="status"><ShieldCheck size={17} /><div>Válido até {fmtDateTime(expires)}. Copie agora: por segurança, este endereço não aparece de novo.</div></div>
          <div className="url-box">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Endereço do link" data-testid="input-share-url" />
            <button type="button" className="btn primary" onClick={copy} data-testid="button-copy-share">{copied ? <><Check size={15} />Copiado</> : <><Copy size={15} />Copiar</>}</button>
          </div>
          <ErrorBox error={act.error} />
          <div className="modal-foot">
            <a className="btn" href={url} target="_blank" rel="noopener noreferrer" data-testid="link-open-share"><ExternalLink size={15} />Abrir</a>
            <button type="button" className="btn" onClick={close} data-testid="button-done-share">Concluir</button>
          </div>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <fieldset className="form form-fields" disabled={act.busy}>
            <div className="small muted">Quem tiver o link consegue baixar estes {items.length} arquivo(s) até expirar ou ser revogado, sem precisar de login.</div>
            <div className="sel-sum" data-testid="list-share-items">{items.map((i) => <span key={i.key}>{KIND[i.kind]} · {i.label}</span>)}</div>
            {hasDocs && <div className="alert warn"><AlertTriangle size={17} /><div>A seleção inclui documentos. Eles podem conter dados pessoais, matrícula ou valores. Confirme que podem sair da equipe.</div></div>}
            <label className="f">Validade em dias (1 a 30)
              <div className="days">
                <input type="number" min={1} max={30} step={1} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} required data-testid="input-share-days" />
                {[1, 7, 15, 30].map((v) => <button type="button" key={v} className={`chip ${days === String(v) ? "on" : ""}`} onClick={() => setDays(String(v))}>{v} d</button>)}
              </div>
            </label>
            {!daysOk && <div className="small" style={{ color: "hsl(var(--bad))" }}>Escolha de 1 a 30 dias.</div>}
            <label className="consent">
              <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} data-testid="checkbox-share-reviewed" />
              <span>Revisei o conteúdo de cada arquivo e autorizo compartilhá-los. Sei que podem conter dados privados e que o link funciona para qualquer pessoa que o receber.</span>
            </label>
            <ErrorBox error={act.error} />
            <div className="modal-foot">
              <button type="button" className="btn" onClick={close}>Cancelar</button>
              <button className="btn primary" disabled={!reviewed || !daysOk || act.busy || !items.length} data-testid="button-create-share">{act.busy ? "Criando…" : <><Link2 size={15} />Criar link</>}</button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}

function shareStatus(s: MaterialShare) {
  if (s.revoked_at) return { t: "Revogado", c: "bad", active: false };
  if (new Date(s.expires_at).getTime() <= Date.now()) return { t: "Expirado", c: "", active: false };
  return { t: "Ativo", c: "ok", active: true };
}
function SharesCard({ farmId, q }: { farmId: number; q: { data: { links: MaterialShare[] } | null; error: ApiError | null; loading: boolean; reload: () => void } }) {
  const act = useAction();
  const [ok, setOk] = useState("");
  const revoke = async (s: MaterialShare) => {
    if (!window.confirm("Revogar este link? Quem tiver o endereço perde o acesso na hora.")) return;
    setOk("");
    const r = await act.run(async () => { await materialsApi.revokeShare(farmId, s.id); return true; });
    if (r) { setOk("Link revogado."); q.reload(); }
  };
  const links = q.data?.links ?? [];
  return (
    <section className="card" aria-labelledby="shares-title" data-testid="card-material-shares">
      <div className="card-h"><h2 id="shares-title">Links emitidos <span className="tag">{links.length}</span></h2></div>
      <p className="small muted" style={{ marginTop: 0 }}>O endereço só aparece no momento da criação. Se perdeu, revogue e crie outro.</p>
      {ok && <div className="alert ok" role="status" style={{ marginBottom: 8 }}><ShieldCheck size={17} />{ok}</div>}
      <ErrorBox error={act.error} />
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data ? <Skeleton rows={2} /> : q.data && (links.length ? (
        <div>{links.map((s) => {
          const st = shareStatus(s);
          return (
            <div className="share-row" key={s.id} data-testid={`row-share-${s.id}`}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.item_count} arquivo{s.item_count === 1 ? "" : "s"} <span className={`tag ${st.c}`}>{st.t}</span></div>
                <div className="small muted">Criado {fmtDateTime(s.created_at)} · {s.revoked_at ? `revogado ${fmtDateTime(s.revoked_at)}` : `${st.active ? "expira" : "expirou"} ${fmtDateTime(s.expires_at)}`}</div>
              </div>
              {st.active && s.can_revoke && <button className="btn sm danger" onClick={() => revoke(s)} disabled={act.busy} data-testid={`button-revoke-share-${s.id}`}><Ban size={14} />Revogar</button>}
            </div>
          );
        })}</div>
      ) : <div className="muted small">Nenhum link criado. Marque arquivos acima e use “Criar link”.</div>)}
    </section>
  );
}
