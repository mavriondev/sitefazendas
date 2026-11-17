import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, Handshake, ListFilter, UserPlus, ChevronUp, MessageCircle, Pencil, Phone, Plus, Search, Trash2, Mail } from "lucide-react";
import { isClosedStage } from "../shared";
import { api, ETAPAS, ROTULOS, isCliente, type Deal, type Etapa } from "./api";
import { ContactForm, DealForm } from "./forms";
import { DealContactButtons, DealPanel, waMessage } from "./quick";
import { MoreActions, NovoAtendimento } from "./menu";
import { usePrefs } from "./prefs";
import { Empty, ErrorBox, EtapaTag, History, PerfilTag, RetornoTag, Skeleton, confirmLeave, dayDiff, fmtDate, fmtPhone, initials, useAction, useAuth, useLoad, waLink } from "./ui";

export function DealRow({ d, hide, onChanged }: { d: Deal; hide?: "contato" | "fazenda"; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="deal" data-testid={`row-deal-${d.id}`}>
      <div className="deal-top">
        <div className="item-main">
          <div className="item-title">
            {hide === "contato" ? <Link to={`/fazendas/${d.fazenda_id}`}>{d.fazenda_titulo}</Link> : <Link to={`/contatos/${d.contato_id}`}>{d.contato_nome}</Link>}
          </div>
          <div className="item-sub">{hide ? `Atualizado ${fmtDate(d.atualizado_em)}` : d.fazenda_titulo}</div>
        </div>
        <DealContactButtons d={d} />
      </div>
      {d.observacoes && <div className="deal-note">{d.observacoes}</div>}
      <div className="deal-tags">
        <EtapaTag e={d.etapa} /><RetornoTag iso={d.proximo_retorno} />
        <button className="deal-toggle" onClick={() => { if (!open || confirmLeave()) setOpen((o) => !o); }} aria-expanded={open} data-testid={`button-status-${d.id}`}>Registrar retorno{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
      </div>
      {open && <DealPanel d={d} onChanged={onChanged} />}
    </div>
  );
}

/* ---------- Hoje ---------- */
function Bucket({ id, title, hint, deals, onChanged, tone }: { id: string; title: string; hint: string; deals: Deal[]; onChanged: () => void; tone?: "hot" }) {
  return (
    <section className={`card bucket ${tone ?? ""}`} aria-labelledby={`h-${id}`} data-testid={`section-${id}`}>
      <div className="card-h"><h2 id={`h-${id}`}>{title} <span className={`tag ${tone === "hot" && deals.length ? "bad" : ""}`}>{deals.length}</span></h2></div>
      {deals.length ? <div className="list">{deals.map((d) => <DealRow key={d.id} d={d} onChanged={onChanged} />)}</div> : <div className="small muted">{hint}</div>}
    </section>
  );
}
export function Home() {
  const { user } = useAuth();
  const q = useLoad(() => api.deals(), []);
  const [quick, setQuick] = useState(false);
  const nav = useNavigate();
  const prefs = usePrefs();
  const deals = q.data?.negociacoes ?? [];
  const ativas = deals.filter((d) => !isClosedStage(d.etapa));
  const byDate = (a: Deal, b: Deal) => a.proximo_retorno!.localeCompare(b.proximo_retorno!);
  const atrasados = ativas.filter((d) => d.proximo_retorno && dayDiff(d.proximo_retorno) < 0).sort(byDate);
  const hoje = ativas.filter((d) => d.proximo_retorno && dayDiff(d.proximo_retorno) === 0).sort(byDate);
  const proximos = ativas.filter((d) => d.proximo_retorno && dayDiff(d.proximo_retorno) > 0).sort(byDate);
  const sem = ativas.filter((d) => !d.proximo_retorno);
  return (
    <div className="page">
      <div className="head">
        <div><div className="eyebrow">Bom trabalho, {user.nome.split(" ")[0]}</div><h1>Hoje</h1></div>
        <div className="row">
          <button className="btn primary" onClick={() => setQuick(true)} data-testid="button-quick-contact"><Plus size={16} />Novo atendimento</button>
          <MoreActions items={[
            { label: "Nova negociação", icon: Handshake, to: "/negociacoes/todas?nova=1", testid: "link-new-deal" },
            { label: "Todas as negociações", icon: ListFilter, to: "/negociacoes/todas", testid: "link-all-deals" },
          ]} />
        </div>
      </div>
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data ? <Skeleton /> : q.data && (
        <>
          {ativas.length === 0 ? <Empty title="Nenhum retorno pendente">Registre um novo atendimento para começar o dia.</Empty> : (<>
            <Bucket id="atrasados" title="Atrasados" tone="hot" hint="Nada atrasado." deals={atrasados} onChanged={q.reload} />
            <Bucket id="hoje" title="Hoje" hint="Nenhum retorno marcado para hoje." deals={hoje} onChanged={q.reload} />
            <Bucket id="proximos" title="Próximos" hint="Nenhum retorno futuro marcado." deals={proximos} onChanged={q.reload} />
            {sem.length > 0 && (
              <details className="card fold" data-testid="section-sem-retorno">
                <summary>Sem retorno marcado <span className="tag warn">{sem.length}</span></summary>
                <div className="list" style={{ marginTop: 10 }}>{sem.map((d) => <DealRow key={d.id} d={d} onChanged={q.reload} />)}</div>
              </details>
            )}
          </>)}
          <details className="card fold" data-testid="section-indicadores">
            <summary>Indicadores e funil</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              {prefs.resumo && (
                <div className="mini-stats" data-testid="resumo">
                  <Link className={`mini ${atrasados.length ? "hot" : ""}`} to="/negociacoes/todas?retorno=atrasado" data-testid="stat-overdue"><b>{atrasados.length}</b><span>Atrasados</span></Link>
                  <Link className="mini" to="/negociacoes/todas?retorno=hoje" data-testid="stat-today"><b>{hoje.length}</b><span>Hoje</span></Link>
                  <Link className="mini" to="/negociacoes/todas?retorno=sem" data-testid="stat-noreturn"><b>{sem.length}</b><span>Sem retorno</span></Link>
                  <Link className="mini" to="/negociacoes/todas" data-testid="stat-active"><b>{ativas.length}</b><span>Ativas</span></Link>
                </div>
              )}
              {prefs.porEtapa && (deals.length === 0 ? <div className="small muted">Nenhuma negociação ainda.</div> : (
                <div className="stack" style={{ gap: 8 }}>
                  {ETAPAS.map((e) => {
                    const n = deals.filter((d) => d.etapa === e).length;
                    return (
                      <Link key={e} to={`/negociacoes/todas?etapa=${e}`} className="row stage-row" style={{ textDecoration: "none", color: "inherit", justifyContent: "space-between" }} data-testid={`link-stage-${e}`}>
                        <EtapaTag e={e} />
                        <span style={{ flex: 1, height: 6, margin: "0 10px", background: "hsl(var(--paper-2))", borderRadius: 9, overflow: "hidden" }}>
                          <span style={{ display: "block", height: "100%", width: `${(n / deals.length) * 100}%`, background: "hsl(var(--ink))" }} />
                        </span>
                        <b className="mono">{n}</b>
                      </Link>
                    );
                  })}
                </div>
              ))}
              {!prefs.resumo && !prefs.porEtapa && <div className="small muted">Indicadores ocultos. Ative em <Link to="/conta">Minha conta</Link>.</div>}
              <Link className="small" to="/negociacoes" data-testid="link-overview">Abrir visão geral das negociações</Link>
            </div>
          </details>
        </>
      )}
      {quick && <NovoAtendimento onClose={() => setQuick(false)} onSaved={(c) => { setQuick(false); nav(`/contatos/${c.id}`, { state: { atendimentoSalvo: true } }); }} />}
    </div>
  );
}

/* ---------- Contatos ---------- */
export function Contacts() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const list = useLoad(() => Promise.all([api.contacts(term), api.deals()]), [term]);
  const [creating, setCreating] = useState(false);
  const [quick, setQuick] = useState(false);
  const [perfil, setPerfil] = useState<"todos" | "contatos" | "clientes">("todos");
  const clientes = useMemo(() => {
    const set = new Set<number>(); const por = new Map<number, string[]>();
    for (const d of list.data?.[1].negociacoes ?? []) por.set(d.contato_id, [...(por.get(d.contato_id) ?? []), d.etapa]);
    for (const [id, et] of por) if (isCliente(et)) set.add(id);
    return set;
  }, [list.data]);
  const nav = useNavigate();
  const shownContacts = () => (list.data?.[0].contatos ?? []).filter((c) => perfil === "todos" || (perfil === "clientes") === clientes.has(c.id));
  return (
    <div className="page">
      <div className="head">
        <div><div className="eyebrow">Carteira</div><h1>Contatos</h1></div>
        <div className="row">
          <button className="btn primary" onClick={() => setQuick(true)} data-testid="button-new-contact"><Plus size={16} />Novo atendimento</button>
          <MoreActions items={[{ label: "Cadastro completo", icon: UserPlus, onSelect: () => setCreating(true), testid: "button-full-contact" }]} />
        </div>
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <div className="search"><Search size={16} /><input type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} placeholder="Nome, telefone ou e-mail" data-testid="input-search-contacts" /></div>
        <button className="btn" data-testid="button-search">Buscar</button>
      </form>
      <ErrorBox error={list.error} retry={list.reload} />
      <div className="chips" role="group" aria-label="Perfil">
        {([["todos", "Todos"], ["contatos", "Só contatos"], ["clientes", "Clientes"]] as const).map(([k, l]) => <button key={k} className={`chip ${perfil === k ? "on" : ""}`} onClick={() => setPerfil(k)} data-testid={`chip-perfil-${k}`}>{l}</button>)}
      </div>
      {list.loading && !list.data ? <Skeleton rows={6} /> : list.data && (shownContacts().length === 0 ?
        <Empty title={term ? "Ninguém encontrado" : "Carteira vazia"}>{term ? `Nada corresponde a "${term}".` : "Cadastre o primeiro contato para começar."}</Empty> : (
        <div className="list">
          {shownContacts().map((c) => (
            <Link key={c.id} to={`/contatos/${c.id}`} className="item" data-testid={`row-contact-${c.id}`}>
              <span className="avatar">{initials(c.nome)}</span>
              <div className="item-main"><div className="item-title">{c.nome}</div><div className="item-sub"><span className="mono">{fmtPhone(c.telefone)}</span> · {c.responsavel_nome}</div></div>
              <PerfilTag cliente={clientes.has(c.id)} />
              {c.fazenda_ids.length > 0 && <span className="tag">{c.fazenda_ids.length} faz.</span>}
            </Link>
          ))}
        </div>
      ))}
      {creating && <ContactForm onClose={() => setCreating(false)} onSaved={(c) => { setCreating(false); nav(`/contatos/${c.id}`); }} />}
      {quick && <NovoAtendimento onClose={() => setQuick(false)} onSaved={(c) => { setQuick(false); nav(`/contatos/${c.id}`, { state: { atendimentoSalvo: true } }); }} />}
    </div>
  );
}

export function ContactDetail() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const q = useLoad(() => Promise.all([api.contact(id), api.farms()]), [id]);
  const [editing, setEditing] = useState(false);
  const [deal, setDeal] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const [saved, setSaved] = useState(false);
  const loc = useLocation();
  const del = useAction();
  useEffect(() => { setSaved(false); }, [id]);
  useEffect(() => {
    if ((loc.state as { atendimentoSalvo?: boolean } | null)?.atendimentoSalvo) {
      setSaved(true);
      nav(loc.pathname + loc.search, { replace: true, state: null });
    }
  }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.loading && !q.data) return <div className="page"><Skeleton rows={5} /></div>;
  if (!q.data) return <div className="page"><Link className="back" to="/contatos"><ArrowLeft size={14} />Contatos</Link><ErrorBox error={q.error} retry={q.error?.status === 404 || q.error?.status === 403 ? undefined : q.reload} /></div>;
  const [{ contato: c, negociacoes, historico }, { fazendas }] = q.data;
  const linked = fazendas.filter((f) => c.fazenda_ids.includes(f.id));
  const wa = msg ?? waMessage(c.nome, linked.length === 1 ? linked[0]!.titulo : null);
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
          <div style={{ minWidth: 0 }}><div className="eyebrow">Responsável: {c.responsavel_nome}</div><h1 data-testid="text-contact-name">{c.nome}</h1><div style={{ marginTop: 6 }}><PerfilTag cliente={isCliente(negociacoes.map((d) => d.etapa))} /></div></div>
          <div className="row">
            <button className="btn primary" onClick={() => { setSaved(false); setQuick(true); }} data-testid="button-contact-novo-atendimento"><Plus size={16} />Novo atendimento</button>
            <MoreActions items={[
              { label: "Editar contato", icon: Pencil, onSelect: () => { setSaved(false); setEditing(true); }, testid: "button-edit-contact" },
              { label: "Nova negociação", icon: Handshake, onSelect: () => { setSaved(false); setDeal(true); }, testid: "button-new-deal-menu" },
              { label: "Remover contato", icon: Trash2, onSelect: remove, danger: true, disabled: del.busy, testid: "button-delete-contact" },
            ]} />
          </div>
        </div>
      </div>
      {saved && <div className="alert ok" role="status" data-testid="status-atendimento-salvo"><CheckCircle2 size={17} />Atendimento salvo.</div>}
      <ErrorBox error={q.error} retry={q.reload} />
      <ErrorBox error={del.error} />
      <div className="grid2">
        <div className="stack">
          <section className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              {c.telefone ? <a className="btn accent" href={`tel:${c.telefone}`} data-testid="link-call"><Phone size={15} /><span className="mono">{fmtPhone(c.telefone)}</span></a> : <span className="muted">Telefone não informado na origem.</span>}
              {c.email && <a className="btn" href={`mailto:${c.email}`} data-testid="link-email"><Mail size={15} />{c.email}</a>}
            </div>
            <label className="f">Mensagem para WhatsApp
              <textarea value={wa} onChange={(e) => setMsg(e.target.value)} placeholder={`Olá, ${c.nome.split(" ")[0]}! Aqui é da Gramogol…`} style={{ minHeight: 64 }} data-testid="input-wa-message" />
            </label>
            <div className="row" style={{ marginTop: 8 }}>
              <a className="btn" aria-disabled={!wa.trim() || !c.telefone} style={!wa.trim() || !c.telefone ? { opacity: .5, pointerEvents: "none" } : undefined}
                onClick={e => { if (!wa.trim() || !c.telefone) e.preventDefault(); }}
                href={c.telefone && wa.trim() ? waLink(c.telefone, wa) : undefined} target="_blank" rel="noopener noreferrer" data-testid="link-whatsapp"><MessageCircle size={15} />Abrir no WhatsApp</a>
            </div>
            <dl className="kv" style={{ marginTop: 16 }}>
              <dt>Origem</dt><dd>{c.origem || "—"}</dd>
              <dt>Cadastrado</dt><dd>{fmtDate(c.criado_em)}</dd>
              <dt>Observações</dt><dd style={{ whiteSpace: "pre-wrap" }}>{c.observacoes || "—"}</dd>
            </dl>
          </section>
          <section className="card">
            <div className="card-h"><h2>Negociações</h2><button className="btn sm primary" onClick={() => setDeal(true)} data-testid="button-new-deal"><Plus size={14} />Nova</button></div>
            {negociacoes.length ? <div className="list">{negociacoes.map((d) => <DealRow key={d.id} d={d} hide="contato" onChanged={q.reload} />)}</div> : <Empty title="Sem negociações">Registre o interesse deste contato em uma fazenda.</Empty>}
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
      {quick && <NovoAtendimento presetContato={c} onClose={() => setQuick(false)} onSaved={(n) => { setQuick(false); if (n.id === c.id) { q.reload(); setSaved(true); } else nav(`/contatos/${n.id}`, { state: { atendimentoSalvo: true } }); }} />}
      {deal && <DealForm deal={null} presetContato={c.id} onClose={() => setDeal(false)} onSaved={() => { setDeal(false); q.reload(); }} />}
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
  const [creating, setCreating] = useState(!!sp.get("nova"));
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
        <div><Link className="back" to="/negociacoes"><ArrowLeft size={14} />Por fazenda</Link><div className="eyebrow">Todas por retorno</div><h1>Negociações</h1></div>
        <button className="btn primary" onClick={() => setCreating(true)} data-testid="button-new-deal"><Plus size={16} />Nova negociação</button>
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
        <div className="list">{shown.map((d) => <DealRow key={d.id} d={d} onChanged={q.reload} />)}</div> :
        <Empty title="Nada neste filtro">{q.data.negociacoes.length ? "Ajuste a etapa ou o retorno." : "Nenhuma negociação registrada ainda."}</Empty>)}
      {creating && <DealForm onClose={() => { setCreating(false); setParam("nova", ""); }} onSaved={() => { setCreating(false); q.reload(); }} />}
    </div>
  );
}
