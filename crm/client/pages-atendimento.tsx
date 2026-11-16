import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, MessageCircle, Pencil, Phone, Plus, Search, Trash2, Mail } from "lucide-react";
import { api, ETAPAS, ROTULOS, type Deal, type Etapa } from "./api";
import { ContactForm, DealForm } from "./forms";
import { Empty, ErrorBox, EtapaTag, History, RetornoTag, Skeleton, dayDiff, fmtDate, initials, useAction, useAuth, useLoad, waLink } from "./ui";

export function DealRow({ d, onEdit, hide }: { d: Deal; onEdit: (d: Deal) => void; hide?: "contato" | "fazenda" }) {
  return (
    <div className="item" data-testid={`row-deal-${d.id}`}>
      <div className="item-main">
        <div className="item-title">
          {hide === "contato" ? <Link to={`/fazendas/${d.fazenda_id}`}>{d.fazenda_titulo}</Link> : <Link to={`/contatos/${d.contato_id}`}>{d.contato_nome}</Link>}
        </div>
        <div className="item-sub">{hide ? `Atualizado ${fmtDate(d.atualizado_em)}` : d.fazenda_titulo}{d.observacoes ? ` · ${d.observacoes}` : ""}</div>
        <div className="row" style={{ marginTop: 6 }}><EtapaTag e={d.etapa} /><RetornoTag iso={d.proximo_retorno} /></div>
      </div>
      <button className="btn sm" onClick={() => onEdit(d)} aria-label="Editar negociação" data-testid={`button-edit-deal-${d.id}`}><Pencil size={14} /></button>
    </div>
  );
}

/* ---------- Visão geral ---------- */
export function Home() {
  const { user } = useAuth();
  const q = useLoad(() => api.deals(), []);
  const [edit, setEdit] = useState<Deal | null>(null);
  const deals = q.data?.negociacoes ?? [];
  const ativas = deals.filter((d) => d.etapa !== "concluida" && d.etapa !== "nao_avancou");
  const retornos = ativas.filter((d) => d.proximo_retorno && dayDiff(d.proximo_retorno) <= 7).sort((a, b) => a.proximo_retorno!.localeCompare(b.proximo_retorno!));
  const atrasados = ativas.filter((d) => d.proximo_retorno && dayDiff(d.proximo_retorno) < 0).length;
  const hoje = ativas.filter((d) => d.proximo_retorno && dayDiff(d.proximo_retorno) === 0).length;
  const semRetorno = ativas.filter((d) => !d.proximo_retorno).length;
  return (
    <div className="page">
      <div className="head">
        <div><div className="eyebrow">Bom trabalho, {user.nome.split(" ")[0]}</div><h1>Retornos e negócios</h1></div>
        <Link className="btn primary" to="/negociacoes?nova=1" data-testid="link-new-deal"><Plus size={16} />Negociação</Link>
      </div>
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data ? <Skeleton /> : q.data && (
        <>
          <div className="stats">
            <Link className="stat hot" to="/negociacoes?retorno=atrasado" data-testid="stat-overdue"><b>{atrasados}</b><span>Retornos atrasados</span></Link>
            <Link className="stat" to="/negociacoes?retorno=hoje" data-testid="stat-today"><b>{hoje}</b><span>Para hoje</span></Link>
            <Link className="stat" to="/negociacoes?retorno=sem" data-testid="stat-noreturn"><b>{semRetorno}</b><span>Ativas sem retorno</span></Link>
            <Link className="stat" to="/negociacoes" data-testid="stat-active"><b>{ativas.length}</b><span>Negociações ativas</span></Link>
          </div>
          <div className="grid2">
            <section className="card">
              <div className="card-h"><h2>Próximos 7 dias</h2><CalendarClock size={18} className="muted" /></div>
              {retornos.length ? <div className="list">{retornos.map((d) => <DealRow key={d.id} d={d} onEdit={setEdit} />)}</div>
                : <Empty title="Agenda livre">Nenhum retorno marcado até a próxima semana.</Empty>}
            </section>
            <section className="card">
              <div className="card-h"><h2>Por etapa</h2></div>
              {deals.length === 0 ? <Empty title="Nenhuma negociação">Abra um contato e registre o primeiro interesse.</Empty> : (
                <div className="stack" style={{ gap: 8 }}>
                  {ETAPAS.map((e) => {
                    const n = deals.filter((d) => d.etapa === e).length;
                    return (
                      <Link key={e} to={`/negociacoes?etapa=${e}`} className="row" style={{ textDecoration: "none", color: "inherit", justifyContent: "space-between" }} data-testid={`link-stage-${e}`}>
                        <EtapaTag e={e} />
                        <span style={{ flex: 1, height: 6, margin: "0 10px", background: "hsl(var(--paper-2))", borderRadius: 9, overflow: "hidden" }}>
                          <span style={{ display: "block", height: "100%", width: `${(n / deals.length) * 100}%`, background: "hsl(var(--ink))" }} />
                        </span>
                        <b className="mono">{n}</b>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}
      {edit && <DealForm deal={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(); }} />}
    </div>
  );
}

/* ---------- Contatos ---------- */
export function Contacts() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const list = useLoad(() => api.contacts(term), [term]);
  const [creating, setCreating] = useState(false);
  const nav = useNavigate();
  return (
    <div className="page">
      <div className="head">
        <div><div className="eyebrow">Carteira</div><h1>Contatos</h1></div>
        <button className="btn primary" onClick={() => setCreating(true)} data-testid="button-new-contact"><Plus size={16} />Novo contato</button>
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <div className="search"><Search size={16} /><input type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} placeholder="Nome, telefone ou e-mail" data-testid="input-search-contacts" /></div>
        <button className="btn" data-testid="button-search">Buscar</button>
      </form>
      <ErrorBox error={list.error} retry={list.reload} />
      {list.loading && !list.data ? <Skeleton rows={6} /> : list.data && (list.data.contatos.length === 0 ?
        <Empty title={term ? "Ninguém encontrado" : "Carteira vazia"}>{term ? `Nada corresponde a "${term}".` : "Cadastre o primeiro contato para começar."}</Empty> : (
        <div className="list">
          {list.data.contatos.map((c) => (
            <Link key={c.id} to={`/contatos/${c.id}`} className="item" data-testid={`row-contact-${c.id}`}>
              <span className="avatar">{initials(c.nome)}</span>
              <div className="item-main"><div className="item-title">{c.nome}</div><div className="item-sub"><span className="mono">{c.telefone}</span> · {c.responsavel_nome}</div></div>
              {c.fazenda_ids.length > 0 && <span className="tag">{c.fazenda_ids.length} faz.</span>}
            </Link>
          ))}
        </div>
      ))}
      {creating && <ContactForm onClose={() => setCreating(false)} onSaved={(c) => { setCreating(false); nav(`/contatos/${c.id}`); }} />}
    </div>
  );
}

export function ContactDetail() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const q = useLoad(() => Promise.all([api.contact(id), api.farms()]), [id]);
  const [editing, setEditing] = useState(false);
  const [deal, setDeal] = useState<Deal | "new" | null>(null);
  const [msg, setMsg] = useState("");
  const del = useAction();
  if (q.loading && !q.data) return <div className="page"><Skeleton rows={5} /></div>;
  if (!q.data) return <div className="page"><Link className="back" to="/contatos"><ArrowLeft size={14} />Contatos</Link><ErrorBox error={q.error} retry={q.error?.status === 404 || q.error?.status === 403 ? undefined : q.reload} /></div>;
  const [{ contato: c, negociacoes, historico }, { fazendas }] = q.data;
  const linked = fazendas.filter((f) => c.fazenda_ids.includes(f.id));
  const remove = async () => {
    if (!window.confirm(`Remover o contato ${c.nome} e suas negociações no CRM? Esta ação não pode ser desfeita. O cadastro no site não será alterado.`)) return;
    const ok = await del.run(async () => { await api.deleteContact(c.id, c.versao); return true; });
    if (ok) nav("/contatos");
  };
  return (
    <div className="page">
      <div>
        <Link className="back" to="/contatos"><ArrowLeft size={14} />Contatos</Link>
        <div className="head">
          <div style={{ minWidth: 0 }}><div className="eyebrow">Responsável: {c.responsavel_nome}</div><h1 data-testid="text-contact-name">{c.nome}</h1></div>
          <div className="row">
            <button className="btn" onClick={() => setEditing(true)} data-testid="button-edit-contact"><Pencil size={15} />Editar</button>
            <button className="btn danger" onClick={remove} disabled={del.busy} data-testid="button-delete-contact"><Trash2 size={15} />Remover</button>
          </div>
        </div>
      </div>
      <ErrorBox error={q.error} retry={q.reload} />
      <ErrorBox error={del.error} />
      <div className="grid2">
        <div className="stack">
          <section className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              {c.telefone ? <a className="btn accent" href={`tel:${c.telefone}`} data-testid="link-call"><Phone size={15} /><span className="mono">{c.telefone}</span></a> : <span className="muted">Telefone não informado na origem.</span>}
              {c.email && <a className="btn" href={`mailto:${c.email}`} data-testid="link-email"><Mail size={15} />{c.email}</a>}
            </div>
            <label className="f">Mensagem para WhatsApp
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={`Olá, ${c.nome.split(" ")[0]}! Aqui é da Gramogol…`} style={{ minHeight: 64 }} data-testid="input-wa-message" />
            </label>
            <div className="row" style={{ marginTop: 8 }}>
              <a className="btn" aria-disabled={!msg.trim() || !c.telefone} style={!msg.trim() || !c.telefone ? { opacity: .5, pointerEvents: "none" } : undefined}
                onClick={e => { if (!msg.trim() || !c.telefone) e.preventDefault(); }}
                href={c.telefone && msg.trim() ? waLink(c.telefone, msg) : undefined} target="_blank" rel="noopener noreferrer" data-testid="link-whatsapp"><MessageCircle size={15} />Abrir no WhatsApp</a>
            </div>
            <dl className="kv" style={{ marginTop: 16 }}>
              <dt>Origem</dt><dd>{c.origem || "—"}</dd>
              <dt>Cadastrado</dt><dd>{fmtDate(c.criado_em)}</dd>
              <dt>Observações</dt><dd style={{ whiteSpace: "pre-wrap" }}>{c.observacoes || "—"}</dd>
            </dl>
          </section>
          <section className="card">
            <div className="card-h"><h2>Negociações</h2><button className="btn sm primary" onClick={() => setDeal("new")} data-testid="button-new-deal"><Plus size={14} />Nova</button></div>
            {negociacoes.length ? <div className="list">{negociacoes.map((d) => <DealRow key={d.id} d={d} hide="contato" onEdit={setDeal} />)}</div> : <Empty title="Sem negociações">Registre o interesse deste contato em uma fazenda.</Empty>}
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <div className="card-h"><h2>Fazendas vinculadas</h2></div>
            {linked.length ? <div className="list">{linked.map((f) => <Link key={f.id} className="item" to={`/fazendas/${f.id}`}><div className="item-main"><div className="item-title">{f.titulo}</div><div className="item-sub">{f.regiao ?? "—"}</div></div></Link>)}</div>
              : <Empty title="Nenhum vínculo">{c.fazenda_ids.length ? `${c.fazenda_ids.length} vínculo(s) fora do seu acesso.` : "Edite o contato para vincular fazendas."}</Empty>}
          </section>
          <section className="card"><div className="card-h"><h2>Histórico</h2></div><History events={historico} /></section>
        </div>
      </div>
      {editing && <ContactForm contact={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); q.reload(); }} />}
      {deal && <DealForm deal={deal === "new" ? null : deal} presetContato={c.id} onClose={() => setDeal(null)} onSaved={() => { setDeal(null); q.reload(); }} />}
    </div>
  );
}

/* ---------- Negociações ---------- */
const RET = { todos: "Todos", atrasado: "Atrasados", hoje: "Hoje", semana: "7 dias", sem: "Sem retorno" } as const;
type Ret = keyof typeof RET;
export function Deals() {
  const [sp, setSp] = useSearchParams();
  const etapa = (sp.get("etapa") ?? "") as Etapa | "";
  const ret = (sp.get("retorno") ?? "todos") as Ret;
  const q = useLoad(() => api.deals(), []);
  const [edit, setEdit] = useState<Deal | "new" | null>(sp.get("nova") ? "new" : null);
  const [text, setText] = useState("");
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); n.delete("nova"); setSp(n, { replace: true }); };
  const shown = useMemo(() => (q.data?.negociacoes ?? []).filter((d) => {
    if (etapa && d.etapa !== etapa) return false;
    const r = d.proximo_retorno ? dayDiff(d.proximo_retorno) : null;
    if (ret === "atrasado" && !(r !== null && r < 0)) return false;
    if (ret === "hoje" && r !== 0) return false;
    if (ret === "semana" && !(r !== null && r >= 0 && r <= 7)) return false;
    if (ret === "sem" && r !== null) return false;
    const t = text.trim().toLowerCase();
    return !t || d.contato_nome.toLowerCase().includes(t) || d.fazenda_titulo.toLowerCase().includes(t);
  }).sort((a, b) => (a.proximo_retorno ?? "9999").localeCompare(b.proximo_retorno ?? "9999")), [q.data, etapa, ret, text]);
  return (
    <div className="page">
      <div className="head">
        <div><div className="eyebrow">Funil</div><h1>Negociações</h1></div>
        <button className="btn primary" onClick={() => setEdit("new")} data-testid="button-new-deal"><Plus size={16} />Nova negociação</button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="chips" role="group" aria-label="Etapa">
          <button className={`chip ${!etapa ? "on" : ""}`} onClick={() => setParam("etapa", "")} data-testid="chip-stage-all">Todas etapas</button>
          {ETAPAS.map((e) => <button key={e} className={`chip ${etapa === e ? "on" : ""}`} onClick={() => setParam("etapa", e)} data-testid={`chip-stage-${e}`}>{ROTULOS[e]}</button>)}
        </div>
        <div className="chips" role="group" aria-label="Retorno">
          {(Object.keys(RET) as Ret[]).map((r) => <button key={r} className={`chip ${ret === r ? "on" : ""}`} onClick={() => setParam("retorno", r === "todos" ? "" : r)} data-testid={`chip-return-${r}`}>{RET[r]}</button>)}
        </div>
        <div className="search"><Search size={16} /><input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Filtrar por contato ou fazenda" data-testid="input-filter-deals" /></div>
      </div>
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data ? <Skeleton rows={6} /> : q.data && (shown.length ?
        <div className="list">{shown.map((d) => <DealRow key={d.id} d={d} onEdit={setEdit} />)}</div> :
        <Empty title="Nada neste filtro">{q.data.negociacoes.length ? "Ajuste a etapa ou o retorno." : "Nenhuma negociação registrada ainda."}</Empty>)}
      {edit && <DealForm deal={edit === "new" ? null : edit} onClose={() => { setEdit(null); setParam("nova", ""); }} onSaved={() => { setEdit(null); q.reload(); }} />}
    </div>
  );
}
