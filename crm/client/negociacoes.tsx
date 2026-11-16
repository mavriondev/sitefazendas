import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FolderDown, ListFilter, Plus, Search } from "lucide-react";
import { api, ETAPAS, ROTULOS } from "./api";
import { isClosedStage } from "../shared";
import { DealForm } from "./forms";
import { DealRow } from "./pages-atendimento";
import { Empty, ErrorBox, Skeleton, dayDiff, initials, useLoad } from "./ui";

const areaLabel = (v: string | null) => v ? `${Number(v).toLocaleString("pt-BR")} ha` : "";

/* Negociações organizadas por fazenda: o ativo é o centro, os interessados ficam dentro dele. */
export function NegociacoesPorAtivo() {
  const q = useLoad(() => Promise.all([api.deals(), api.farms()]), []);
  const [t, setT] = useState("");
  const [creating, setCreating] = useState(false);
  const rows = useMemo(() => {
    if (!q.data) return [];
    const [{ negociacoes }, { fazendas }] = q.data;
    const s = t.trim().toLowerCase();
    return fazendas.map((f) => {
      const ds = negociacoes.filter((d) => d.fazenda_id === f.id);
      const ativas = ds.filter((d) => !isClosedStage(d.etapa));
      const atrasadas = ativas.filter((d) => d.proximo_retorno && dayDiff(d.proximo_retorno) < 0).length;
      return { f, total: ds.length, ativas: ativas.length, atrasadas };
    }).filter((r) => r.total > 0 && (!s || r.f.titulo.toLowerCase().includes(s) || (r.f.regiao ?? "").toLowerCase().includes(s)))
      .sort((a, b) => b.atrasadas - a.atrasadas || b.ativas - a.ativas || a.f.titulo.localeCompare(b.f.titulo, "pt-BR"));
  }, [q.data, t]);
  return (
    <div className="page">
      <div className="head">
        <div><div className="eyebrow">Por fazenda</div><h1>Negociações</h1></div>
        <button className="btn primary" onClick={() => setCreating(true)} data-testid="button-new-deal"><Plus size={16} />Nova negociação</button>
      </div>
      <div className="row">
        <div className="search" style={{ flex: 1 }}><Search size={16} /><input type="search" value={t} onChange={(e) => setT(e.target.value)} placeholder="Procurar fazenda" data-testid="input-search-negociacoes" /></div>
        <Link className="btn" to="/negociacoes/todas" data-testid="link-all-deals"><ListFilter size={15} />Todas por retorno</Link>
      </div>
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data ? <Skeleton rows={5} /> : q.data && (rows.length ? (
        <div className="list">{rows.map(({ f, ativas, atrasadas }) => (
          <Link key={f.id} to={`/negociacoes/${f.id}`} className="item" data-testid={`row-negociacao-fazenda-${f.id}`}>
            {f.fotos[0] ? <img src={api.photoUrl(f.id, f.fotos[0].arquivo)} alt="" loading="lazy" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 6, flex: "none" }} /> : <span className="avatar" style={{ borderRadius: 6 }}>{initials(f.titulo)}</span>}
            <div className="item-main">
              <div className="item-title">{f.titulo}</div>
              <div className="item-sub">{[f.regiao, areaLabel(f.area)].filter(Boolean).join(" · ") || "—"}</div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className="tag">{ativas} ativa{ativas === 1 ? "" : "s"}</span>
                {atrasadas > 0 && <span className="tag bad">{atrasadas} atrasada{atrasadas === 1 ? "" : "s"}</span>}
              </div>
            </div>
          </Link>
        ))}</div>
      ) : <Empty title={t ? "Nenhuma fazenda encontrada" : "Nenhuma negociação ainda"}>{t ? "Tente outro nome." : "Use “Novo contato” na tela Retornos ou “Nova negociação” para começar."}</Empty>)}
      {creating && <DealForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); q.reload(); }} />}
    </div>
  );
}

/* Página de uma fazenda: todos os interessados, por etapa. */
export function NegociacoesFazenda() {
  const id = Number(useParams().id);
  const q = useLoad(() => api.farm(id), [id]);
  const [creating, setCreating] = useState(false);
  if (q.loading && !q.data) return <div className="page"><Skeleton rows={5} /></div>;
  if (!q.data) return <div className="page"><Link className="back" to="/negociacoes"><ArrowLeft size={14} />Negociações</Link><ErrorBox error={q.error} retry={q.error?.status === 404 || q.error?.status === 403 ? undefined : q.reload} /></div>;
  const { fazenda: f, negociacoes } = q.data;
  const ativas = ETAPAS.filter((e) => !isClosedStage(e)).map((e) => ({ e, ds: negociacoes.filter((d) => d.etapa === e) })).filter((g) => g.ds.length);
  const encerradas = negociacoes.filter((d) => isClosedStage(d.etapa));
  return (
    <div className="page">
      <div>
        <Link className="back" to="/negociacoes"><ArrowLeft size={14} />Negociações</Link>
        <div className="head">
          <div style={{ minWidth: 0 }}><div className="eyebrow">{[f.regiao, areaLabel(f.area)].filter(Boolean).join(" · ") || "Fazenda"}</div><h1 data-testid="text-negociacao-title">{f.titulo}</h1></div>
          <div className="row">
            <Link className="btn" to={`/materiais/${f.id}`}><FolderDown size={15} />Materiais</Link>
            <button className="btn primary" onClick={() => setCreating(true)} disabled={!f.disponivel} data-testid="button-new-deal-farm"><Plus size={16} />Nova negociação</button>
          </div>
        </div>
      </div>
      <ErrorBox error={q.error} retry={q.reload} />
      {negociacoes.length === 0 && <Empty title="Ninguém negociando esta fazenda">Toque em “Nova negociação” para registrar o primeiro interessado.</Empty>}
      {ativas.map(({ e, ds }) => (
        <section className="card" key={e} data-testid={`group-stage-${e}`}>
          <div className="card-h"><h2>{ROTULOS[e]}</h2><span className="tag">{ds.length}</span></div>
          <div className="list">{ds.map((d) => <DealRow key={d.id} d={d} hide="fazenda" onChanged={q.reload} />)}</div>
        </section>
      ))}
      {encerradas.length > 0 && (
        <details className="card" data-testid="group-closed">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Encerradas ({encerradas.length})</summary>
          <div className="list" style={{ marginTop: 10 }}>{encerradas.map((d) => <DealRow key={d.id} d={d} hide="fazenda" onChanged={q.reload} />)}</div>
        </details>
      )}
      {creating && <DealForm presetFazenda={f.id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); q.reload(); }} />}
    </div>
  );
}
