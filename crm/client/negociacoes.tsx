import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ListFilter, Plus, Search } from "lucide-react";
import { api, ETAPAS, ROTULOS, type Deal } from "./api";
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
        <div><Link className="back" to="/mais"><ArrowLeft size={14} />Mais</Link><div className="eyebrow">Visão geral por fazenda</div><h1>Negociações</h1></div>
        <button className="btn primary" onClick={() => setCreating(true)} data-testid="button-new-deal"><Plus size={16} />Nova negociação</button>
      </div>
      <div className="row">
        <div className="search" style={{ flex: 1 }}><Search size={16} /><input type="search" value={t} onChange={(e) => setT(e.target.value)} placeholder="Procurar fazenda" data-testid="input-search-negociacoes" /></div>
        <Link className="btn" to="/negociacoes/todas" data-testid="link-all-deals"><ListFilter size={15} />Todas por retorno</Link>
      </div>
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data ? <Skeleton rows={5} /> : q.data && (rows.length ? (
        <div className="list">{rows.map(({ f, ativas, atrasadas }) => (
          <Link key={f.id} to={`/fazendas/${f.id}?aba=interessados`} className="item" data-testid={`row-negociacao-fazenda-${f.id}`}>
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
      ) : <Empty title={t ? "Nenhuma fazenda encontrada" : "Nenhuma negociação ainda"}>{t ? "Tente outro nome." : "Use Novo atendimento na tela Hoje ou Nova negociação para começar."}</Empty>)}
      {creating && <DealForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); q.reload(); }} />}
    </div>
  );
}

/* Interessados de uma fazenda, por etapa. Usado na aba "Interessados" da ficha. */
export function FarmInterested({ negociacoes, onChanged }: { negociacoes: Deal[]; onChanged: () => void }) {
  const ativas = ETAPAS.filter((e) => !isClosedStage(e)).map((e) => ({ e, ds: negociacoes.filter((d) => d.etapa === e) })).filter((g) => g.ds.length);
  const encerradas = negociacoes.filter((d) => isClosedStage(d.etapa));
  if (!negociacoes.length) return <Empty title="Ninguém interessado ainda">Use Novo atendimento para registrar o primeiro interessado nesta fazenda.</Empty>;
  return (
    <div className="stack">
      {ativas.map(({ e, ds }) => (
        <section className="card" key={e} data-testid={`group-stage-${e}`}>
          <div className="card-h"><h2>{ROTULOS[e]}</h2><span className="tag">{ds.length}</span></div>
          <div className="list">{ds.map((d) => <DealRow key={d.id} d={d} hide="fazenda" onChanged={onChanged} />)}</div>
        </section>
      ))}
      {encerradas.length > 0 && (
        <details className="card fold" data-testid="group-closed">
          <summary>Encerradas ({encerradas.length})</summary>
          <div className="list" style={{ marginTop: 10 }}>{encerradas.map((d) => <DealRow key={d.id} d={d} hide="fazenda" onChanged={onChanged} />)}</div>
        </details>
      )}
    </div>
  );
}
