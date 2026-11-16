import { Fragment, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, FolderDown, Download, ExternalLink, FileText, KeyRound, Lock, Plus, RefreshCw, Search, ShieldCheck, Trash2, Unlock, Upload, UsersRound } from "lucide-react";
import { api, key, type Access, type Deal, type User } from "./api";
import { DealForm } from "./forms";
import { DealRow } from "./pages-atendimento";
import { DocsDownloadAll, DocsReadOnly, PhotosCard, ShareLinkButton } from "./share";
import { Empty, ErrorBox, History, Modal, Skeleton, fmtDate, fmtDateTime, fmtSize, initials, pdfUrl, publicUrl, useAction, useAuth, useDirty, useLoad } from "./ui";

const LABELS: Record<string, string> = { car: "CAR", uf: "UF", preco: "Preço", notas_internas: "Notas internas", municipio: "Município", observacao: "Observação", publico: "Mostrar no site", valor_json: "Informação", agua: "Água", energia: "Energia", argila: "Argila", altitude: "Altitude", confirmado: "Confirmado", nao_informado: "Não informado", nao_detectado: "Não detectado", detectado: "Detectado", corretor: "Cadastro manual" };
export const humanKey = (k: string) => LABELS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");
export const fmtVal = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) return v.length ? v.map(fmtVal).join(", ") : "—";
  if (typeof v === "object") return Object.entries(v).map(([k, val]) => `${humanKey(k)}: ${fmtVal(val)}`).join(" · ") || "—";
  return LABELS[String(v)] ?? String(v);
};
const areaLabel = (v: string | null) => v ? `${Number(v).toLocaleString("pt-BR")} ha` : "";

function SourceBanner({ erro, at }: { erro: boolean; at: string | null }) {
  if (erro) return <div className="alert warn" data-testid="status-source-error"><AlertTriangle size={17} /><div>O site de origem está indisponível. Você está vendo a última cópia salva{at ? ` (${fmtDateTime(at)})` : ""}; nada foi perdido.</div></div>;
  return <div className="small muted" data-testid="text-source-updated">Cópia do site atualizada em {fmtDateTime(at)}</div>;
}

/* ---------- Fazendas ---------- */
export function Farms() {
  const q = useLoad(() => api.farms(), []);
  const [t, setT] = useState("");
  const list = useMemo(() => {
    const s = t.trim().toLowerCase();
    return (q.data?.fazendas ?? []).filter((f) => !s || f.titulo.toLowerCase().includes(s) || (f.regiao ?? "").toLowerCase().includes(s));
  }, [q.data, t]);
  return (
    <div className="page">
      <div className="head"><div><div className="eyebrow">Consulta</div><h1>Fazendas</h1></div></div>
      {q.data && <SourceBanner erro={q.data.fonte.erro} at={q.data.fonte.atualizado_em} />}
      <div className="search"><Search size={16} /><input type="search" value={t} onChange={(e) => setT(e.target.value)} placeholder="Título ou região" data-testid="input-search-farms" /></div>
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data ? <Skeleton rows={6} /> : q.data && (list.length ? (
        <div className="list">{list.map((f) => (
          <Link key={f.id} to={`/fazendas/${f.id}`} className="item" data-testid={`row-farm-${f.id}`}>
            {f.fotos[0] ? <img src={api.photoUrl(f.id, f.fotos[0].arquivo)} alt="" loading="lazy" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 6, flex: "none" }} /> : <span className="avatar" style={{ borderRadius: 6 }}>{initials(f.titulo)}</span>}
            <div className="item-main"><div className="item-title">{f.titulo}</div><div className="item-sub">{[f.regiao, areaLabel(f.area)].filter(Boolean).join(" · ") || "—"}</div></div>
            {!f.disponivel ? <span className="tag bad">Fora do site</span> : f.status !== "publicada" ? <span className="tag">{f.status}</span> : null}
          </Link>
        ))}</div>
      ) : <Empty title={t ? "Nenhuma fazenda encontrada" : "Sem fazendas no seu acesso"}>{t ? "Tente outro termo." : "Peça ao administrador para liberar fazendas para você."}</Empty>)}
    </div>
  );
}

export function FarmDetail() {
  const id = Number(useParams().id);
  const q = useLoad(() => api.farm(id), [id]);
  const [deal, setDeal] = useState(false);
  if (q.loading && !q.data) return <div className="page"><Skeleton rows={5} /></div>;
  if (!q.data) return <div className="page"><Link className="back" to="/fazendas"><ArrowLeft size={14} />Fazendas</Link><ErrorBox error={q.error} retry={q.reload} /></div>;
  const { fazenda: f, documentos, negociacoes, historico, site_url } = q.data;
  const pub = f.disponivel && f.status === "publicada";
  const dados = Object.entries(f.dados ?? {});
  return (
    <div className="page">
      <div>
        <Link className="back" to="/fazendas"><ArrowLeft size={14} />Fazendas</Link>
        <div className="head">
          <div style={{ minWidth: 0 }}><div className="eyebrow">{[f.regiao, areaLabel(f.area)].filter(Boolean).join(" · ") || "Fazenda"}</div><h1 data-testid="text-farm-title">{f.titulo}</h1></div>
          <div className="row">
            <Link className="btn" to={`/materiais/${f.id}`} data-testid="link-farm-materiais"><FolderDown size={15} />Materiais</Link>
            {pub ? (<>
              <a className="btn accent" href={pdfUrl(site_url, f.slug)} target="_blank" rel="noopener noreferrer" data-testid="link-farm-pdf"><FileText size={15} />PDF</a>
              <a className="btn" href={publicUrl(site_url, f.slug)} target="_blank" rel="noopener noreferrer" data-testid="link-farm-public"><ExternalLink size={15} />Página pública</a>
              <ShareLinkButton f={f} url={publicUrl(site_url, f.slug)} />
            </>) : <span className="tag warn">Status: {f.status} — sem link público</span>}
          </div>
        </div>
      </div>
      {!f.disponivel && <div className="alert warn"><AlertTriangle size={17} />Esta fazenda não aparece mais na origem. Os dados abaixo são a última cópia salva em {fmtDateTime(f.atualizado_em)}.</div>}
      <ErrorBox error={q.error} retry={q.reload} />
      <div className="grid2">
        <div className="stack">
          <PhotosCard f={f} />
          <section className="card">
            <div className="card-h"><h2>Dados</h2><span className="small muted">Somente leitura · {fmtDate(f.atualizado_em)}</span></div>
            {f.descricao && <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{f.descricao}</p>}
            {dados.length ? <dl className="kv">{dados.map(([k, v]) => <Fragment key={k}><dt>{humanKey(k)}</dt><dd>{fmtVal(v)}</dd></Fragment>)}</dl> : !f.descricao && <div className="muted small">Sem dados detalhados.</div>}
            {f.atributos.length > 0 && (<>
              <h3 style={{ margin: "16px 0 8px" }}>Atributos</h3>
              <div className="stack" style={{ gap: 8 }}>{f.atributos.map((a, i) => (
                <dl className="kv" key={i} style={{ paddingTop: 8, borderTop: i ? "1px solid hsl(var(--line) / .6)" : 0 }}>
                  <dt>Atributo</dt><dd><strong>{humanKey(String(a.chave ?? "Informação"))}</strong></dd>
                  {Object.entries(a).filter(([k]) => !["id", "fazenda_id", "chave"].includes(k)).map(([k, v]) => <Fragment key={k}><dt>{humanKey(k)}</dt><dd>{fmtVal(v)}</dd></Fragment>)}
                </dl>))}</div>
            </>)}
          </section>
          <section className="card">
            <div className="card-h"><h2>Negociações</h2><button className="btn sm primary" onClick={() => setDeal(true)} disabled={!f.disponivel} data-testid="button-new-deal"><Plus size={14} />Nova</button></div>
            {negociacoes.length ? <div className="list">{negociacoes.map((d) => <DealRow key={d.id} d={d} hide="fazenda" onChanged={q.reload} />)}</div> : <Empty title="Sem negociações">Ninguém em negociação por esta fazenda ainda.</Empty>}
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <div className="card-h"><h2>Documentos <span className="tag">{documentos.length}</span></h2><DocsDownloadAll docs={documentos} /></div>
            {q.data.documentos_erro && <div className="alert warn"><AlertTriangle size={17} />Não foi possível ler os documentos do site agora. Tente de novo em instantes.</div>}
            <DocsReadOnly docs={documentos} />
            <p className="small muted" style={{ marginBottom: 0 }}>Os documentos são enviados no painel do site; aqui só dá para baixar.</p>
          </section>
          <section className="card"><div className="card-h"><h2>Histórico</h2></div><History events={historico} /></section>
        </div>
      </div>
      {deal && <DealForm deal={null} presetFazenda={f.id} onClose={() => setDeal(false)} onSaved={() => { setDeal(false); q.reload(); }} />}
    </div>
  );
}

/* ---------- Equipe ---------- */
function NewUser({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ nome: "", email: "", senha: "" });
  const reqKey = useRef<string | null>(null);
  const act = useAction();
  const clearDirty = useDirty(!!(v.nome || v.email || v.senha));
  const close = () => { if (!act.busy && (!(v.nome || v.email || v.senha) || window.confirm("Descartar os dados da nova conta?"))) onClose(); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqKey.current) reqKey.current = key();
    const r = await act.run(() => api.createUser({ ...v, nome: v.nome.trim(), email: v.email.trim(), request_key: reqKey.current! }));
    if (r) { reqKey.current = null; clearDirty(); onSaved(); }
  };
  return (
    <Modal title="Nova conta de membro" onClose={close}>
      <form className="form" onSubmit={submit}>
        <fieldset className="form form-fields" disabled={act.busy}>
        <label className="f">Nome<input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required data-testid="input-user-name" /></label>
        <label className="f">E-mail<input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required data-testid="input-user-email" /></label>
        <label className="f">Senha inicial (mínimo 12 caracteres)<input type="password" autoComplete="new-password" value={v.senha} onChange={(e) => setV({ ...v, senha: e.target.value })} required minLength={12} data-testid="input-user-password" /></label>
        <ErrorBox error={act.error} />
        <div className="modal-foot"><button type="button" className="btn" onClick={close}>Cancelar</button><button className="btn primary" disabled={act.busy} data-testid="button-create-user">{act.busy ? "Criando…" : "Criar conta"}</button></div>
        </fieldset>
      </form>
    </Modal>
  );
}
function ResetPwd({ u, onClose, onSaved }: { u: User; onClose: () => void; onSaved: () => void }) {
  const [senha, setSenha] = useState("");
  const act = useAction();
  const clearDirty = useDirty(!!senha);
  const close = () => { if (!act.busy && (!senha || window.confirm("Descartar a nova senha digitada?"))) onClose(); };
  return (
    <Modal title={`Nova senha para ${u.nome}`} onClose={close}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); const r = await act.run(() => api.updateUser(u.id, { senha, versao: u.versao })); if (r) { clearDirty(); onSaved(); } }}>
        <fieldset className="form form-fields" disabled={act.busy}>
        <label className="f">Nova senha (mínimo 12 caracteres)<input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={12} data-testid="input-reset-password" /></label>
        <ErrorBox error={act.error} />
        <div className="modal-foot"><button type="button" className="btn" onClick={close}>Cancelar</button><button className="btn primary" disabled={act.busy} data-testid="button-save-reset">{act.busy ? "Salvando…" : "Redefinir"}</button></div>
        </fieldset>
      </form>
    </Modal>
  );
}
function AccessEditor({ u, onClose }: { u: User; onClose: () => void }) {
  const q = useLoad(() => Promise.all([api.access(u.id), api.farms(), api.contacts("")]), [u.id]);
  const [sel, setSel] = useState<Access | null>(null);
  const [ft, setFt] = useState(""); const [ct, setCt] = useState("");
  const act = useAction();
  const cur = sel ?? q.data?.[0] ?? null;
  useDirty(sel !== null);
  const toggle = (k: keyof Access, id: number, on: boolean) => { if (!cur) return; setSel({ ...cur, [k]: on ? [...cur[k], id] : cur[k].filter((x) => x !== id) }); };
  const save = async () => { if (!sel) return; const r = await act.run(async () => { await api.saveAccess(u.id, { fazenda_ids: sel.fazenda_ids.map(Number), contato_ids: sel.contato_ids.map(Number) }); return true; }); if (r) { setSel(null); onClose(); } };
  const close = () => { if (!act.busy && (!sel || window.confirm("Descartar alterações de acesso?"))) onClose(); };
  const match = (s: string, t: string) => s.toLowerCase().includes(t.trim().toLowerCase());
  return (
    <Modal title={`Acessos de ${u.nome}`} onClose={close}>
      <ErrorBox error={q.error} retry={q.reload} />
      {!q.data || !cur ? <Skeleton rows={3} /> : (
        <div className="form">
          <div className="small muted">Contatos sob responsabilidade do membro já são dele. Marque aqui o que mais ele pode consultar.</div>
          <div className="f" style={{ display: "grid", gap: 6 }}>
            <b>Fazendas ({cur.fazenda_ids.length})</b>
            <input placeholder="Filtrar fazendas" value={ft} onChange={(e) => setFt(e.target.value)} />
            <div className="check-list">{q.data[1].fazendas.filter((f) => match(f.titulo, ft)).map((f) => <label key={f.id}><input type="checkbox" checked={cur.fazenda_ids.includes(f.id)} onChange={(e) => toggle("fazenda_ids", f.id, e.target.checked)} data-testid={`checkbox-access-farm-${f.id}`} /><span>{f.titulo}</span></label>)}</div>
          </div>
          <div className="f" style={{ display: "grid", gap: 6 }}>
            <b>Contatos ({cur.contato_ids.length})</b>
            <input placeholder="Filtrar contatos" value={ct} onChange={(e) => setCt(e.target.value)} />
            <div className="check-list">{q.data[2].contatos.filter((c) => match(c.nome + c.telefone, ct)).map((c) => <label key={c.id}><input type="checkbox" checked={cur.contato_ids.includes(c.id)} onChange={(e) => toggle("contato_ids", c.id, e.target.checked)} data-testid={`checkbox-access-contact-${c.id}`} /><span>{c.nome} <span className="muted mono">{c.telefone}</span>{c.fazenda_ids.length === 0 && <span className="muted"> · sem fazenda</span>}</span></label>)}</div>
          </div>
          <ErrorBox error={act.error} />
          <div className="modal-foot"><button className="btn" onClick={close}>Cancelar</button><button className="btn primary" onClick={save} disabled={act.busy || !sel} data-testid="button-save-access">{act.busy ? "Salvando…" : "Salvar acessos"}</button></div>
        </div>
      )}
    </Modal>
  );
}
export function Team() {
  const { user } = useAuth();
  const admin = user.papel === "admin";
  const q = useLoad(() => api.users(), []);
  const [modal, setModal] = useState<{ t: "new" } | { t: "pwd" | "acc"; u: User } | null>(null);
  const [ok, setOk] = useState("");
  const act = useAction();
  const block = async (u: User) => {
    if (!window.confirm(u.bloqueado ? `Desbloquear ${u.nome}?` : `Bloquear ${u.nome}? A pessoa perde o acesso imediatamente.`)) return;
    const r = await act.run(() => api.updateUser(u.id, { bloqueado: !u.bloqueado, versao: u.versao }));
    if (r) q.reload();
  };
  return (
    <div className="page">
      <div className="head">
        <div><div className="eyebrow">{admin ? "Administração" : "Diretório"}</div><h1>Equipe</h1></div>
        {admin && <button className="btn primary" onClick={() => setModal({ t: "new" })} data-testid="button-new-user"><Plus size={16} />Novo membro</button>}
      </div>
      {ok && <div className="alert ok"><ShieldCheck size={17} />{ok}</div>}
      <ErrorBox error={q.error} retry={q.reload} />
      <ErrorBox error={act.error} />
      {q.loading && !q.data ? <Skeleton /> : q.data && (q.data.usuarios.length ? (
        <div className="list">{q.data.usuarios.map((u) => (
          <div className="item" key={u.id} style={{ flexWrap: "wrap" }} data-testid={`row-user-${u.id}`}>
            <span className="avatar">{initials(u.nome)}</span>
            <div className="item-main"><div className="item-title">{u.nome}{u.id === user.id && <span className="muted"> (você)</span>}</div><div className="item-sub">{u.email || "—"}</div></div>
            <div className="row">
              {admin && <span className={`tag ${u.papel === "admin" ? "ok" : ""}`}>{u.papel === "admin" ? "Admin" : "Membro"}</span>}
              {u.bloqueado && <span className="tag bad">Bloqueado</span>}
              {admin && u.id !== user.id && (<>
                {u.papel === "membro" && <button className="btn sm" onClick={() => setModal({ t: "acc", u })} data-testid={`button-access-${u.id}`}><UsersRound size={14} />Acessos</button>}
                <button className="btn sm" onClick={() => setModal({ t: "pwd", u })} data-testid={`button-reset-${u.id}`}><KeyRound size={14} />Senha</button>
                <button className={`btn sm ${u.bloqueado ? "" : "danger"}`} onClick={() => block(u)} disabled={act.busy} data-testid={`button-block-${u.id}`}>{u.bloqueado ? <><Unlock size={14} />Desbloquear</> : <><Lock size={14} />Bloquear</>}</button>
              </>)}
            </div>
          </div>))}</div>
      ) : <Empty title="Sem pessoas">Crie a primeira conta de membro.</Empty>)}
      {modal?.t === "new" && <NewUser onClose={() => setModal(null)} onSaved={() => { setModal(null); setOk("Conta criada."); q.reload(); }} />}
      {modal?.t === "pwd" && <ResetPwd u={modal.u} onClose={() => setModal(null)} onSaved={() => { setModal(null); setOk(`Senha de ${modal.u.nome} redefinida.`); q.reload(); }} />}
      {modal?.t === "acc" && <AccessEditor u={modal.u} onClose={() => { setModal(null); }} />}
    </div>
  );
}

/* ---------- Conta ---------- */
export function Account() {
  const { user } = useAuth();
  const [v, setV] = useState({ atual: "", nova: "", conf: "" });
  const [done, setDone] = useState(false);
  const act = useAction();
  useDirty(!!(v.atual || v.nova));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setDone(false);
    if (v.nova !== v.conf) { act.setError(new Error("A confirmação não confere com a nova senha.")); return; }
    const r = await act.run(async () => { await api.password(v.atual, v.nova); return true; });
    if (r) { setV({ atual: "", nova: "", conf: "" }); setDone(true); }
  };
  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div><div className="eyebrow">{user.papel === "admin" ? "Administrador" : "Membro"}</div><h1>{user.nome}</h1><div className="muted">{user.email}</div></div>
      <form className="card form" onSubmit={submit}>
        <h2>Trocar senha</h2>
        <label className="f">Senha atual<input type="password" autoComplete="current-password" value={v.atual} onChange={(e) => setV({ ...v, atual: e.target.value })} required data-testid="input-current-password" /></label>
        <label className="f">Nova senha (mínimo 12 caracteres)<input type="password" autoComplete="new-password" minLength={12} value={v.nova} onChange={(e) => setV({ ...v, nova: e.target.value })} required data-testid="input-new-password" /></label>
        <label className="f">Confirmar nova senha<input type="password" autoComplete="new-password" value={v.conf} onChange={(e) => setV({ ...v, conf: e.target.value })} required data-testid="input-confirm-password" /></label>
        <ErrorBox error={act.error} />
        {done && <div className="alert ok"><ShieldCheck size={17} />Senha alterada.</div>}
        <button className="btn primary" style={{ justifySelf: "start" }} disabled={act.busy} data-testid="button-change-password">{act.busy ? "Salvando…" : "Salvar nova senha"}</button>
      </form>
    </div>
  );
}

/* ---------- Importação ---------- */
export function Import() {
  const q = useLoad(() => api.farms(), []);
  const ref = useAction(); const imp = useAction();
  const [msg, setMsg] = useState("");
  const refresh = async () => {
    if (!window.confirm("Atualizar a cópia das fazendas a partir do site agora?")) return;
    setMsg("");
    const r = await ref.run(() => api.refreshSource());
    if (r) { setMsg(`${r.fazendas} fazenda(s) sincronizada(s).`); q.reload(); }
  };
  const importar = async () => {
    if (!window.confirm("Importar contatos recebidos pelo site? Telefones já existentes não serão mesclados.")) return;
    setMsg("");
    const r = await imp.run(() => api.importContacts());
    if (r) setMsg(`${r.importados} contato(s) importado(s); ${r.existentes} já existia(m).`);
  };
  const fonte = q.data?.fonte;
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div><div className="eyebrow">Administração</div><h1>Importação</h1></div>
      <ErrorBox error={q.error} retry={q.reload} />
      {fonte && <SourceBanner erro={fonte.erro} at={fonte.atualizado_em} />}
      {fonte?.site_url && <div className="small muted">Origem: <span className="mono">{fonte.site_url}</span></div>}
      {msg && <div className="alert ok" data-testid="status-import"><ShieldCheck size={17} />{msg}</div>}
      <section className="card stack">
        <div><h2>Fazendas do site</h2><p className="muted small" style={{ margin: "4px 0 0" }}>Busca título, dados, atributos e fotos publicados. Os anúncios não são editados por aqui; se a origem falhar, a cópia atual é mantida.</p></div>
        <ErrorBox error={ref.error} />
        <button className="btn primary" style={{ justifySelf: "start" }} onClick={refresh} disabled={ref.busy} data-testid="button-refresh-source"><RefreshCw size={15} />{ref.busy ? "Atualizando…" : "Atualizar da origem"}</button>
      </section>
      <section className="card stack">
        <div><h2>Contatos do site</h2><p className="muted small" style={{ margin: "4px 0 0" }}>Traz os interessados registrados no site como contatos. Duplicidades ficam separadas para revisão.</p></div>
        <ErrorBox error={imp.error} />
        <button className="btn primary" style={{ justifySelf: "start" }} onClick={importar} disabled={imp.busy} data-testid="button-import-contacts"><Upload size={15} />{imp.busy ? "Importando…" : "Importar contatos"}</button>
      </section>
    </div>
  );
}
