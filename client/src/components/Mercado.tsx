import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { WIDGETS_AGRO, type AgroPublico, type NoticiaAgro, type NoticiasAgroResposta } from "../../../shared/agro";
import { dataBr, useCarga } from "../lib/agro";
import "./Mercado.css";

export function Seloformato({ n }: { n: NoticiaAgro }) {
  return <span className={`mk-selo mk-selo--${n.formato}`}>{n.formato === "integral" ? "Texto integral licenciado" : "Resumo · leia a matéria completa na fonte"}</span>;
}

export function CartaoNoticia({ n }: { n: NoticiaAgro }) {
  return <article className="mk-card">
    <div className="mk-meta"><span>{n.fonte_nome}</span><span>{dataBr(n.publicado_em)}</span></div>
    <h3><Link to={`/noticias/${n.slug}`}>{n.titulo}</Link></h3>
    {n.chamada && <p>{n.chamada}</p>}
    <Seloformato n={n} />
  </article>;
}

export function NoticiasHome() {
  const agro = useCarga<AgroPublico>("/api/public/agro");
  const lista = useCarga<NoticiasAgroResposta>(agro.dados?.config.noticias_ativas ? "/api/public/noticias?pagina=1" : null);
  if (agro.dados && !agro.dados.config.noticias_ativas) return null;
  const itens = lista.dados?.noticias.slice(0, 3) ?? [];
  return <section className="ga-section" id="noticias" data-cms-secao="noticias"><div className="ga-wrap">
    <div className="mk-head"><div><span className="mk-kicker">Campo e mercado</span><h2>Notícias do agro</h2></div><Link className="mk-mais" to="/noticias">Todas as notícias <ArrowUpRight size={16} /></Link></div>
    {(agro.carregando || lista.carregando) && <div className="mk-grid" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="mk-card mk-skel" />)}</div>}
    {(agro.erro || lista.erro) && !lista.carregando ? <div className="mk-aviso" role="alert">Não foi possível carregar as notícias. <button onClick={() => { agro.recarregar(); lista.recarregar(); }}>Tentar de novo</button></div> : null}
    {!lista.carregando && !agro.erro && !lista.erro && itens.length === 0 && <p className="mk-vazio">Nenhuma notícia publicada no momento.</p>}
    {itens.length > 0 && <div className="mk-grid">{itens.map(n => <CartaoNoticia key={n.id} n={n} />)}</div>}
  </div></section>;
}

export function CotacoesHome() {
  const agro = useCarga<AgroPublico>("/api/public/agro");
  if (agro.dados && !agro.dados.config.cotacoes_ativas) return null;
  const d = agro.dados?.dolar ?? null;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 });
  return <section className="ga-section ga-section--cream" id="cotacoes" data-cms-secao="cotacoes"><div className="ga-wrap">
    <div className="mk-head"><div><span className="mk-kicker">Referências de preço</span><h2>Cotações</h2></div></div>
    <div className="mk-dolar">
      <div className="mk-dolar-info">
        <span className="mk-rot">Dólar PTAX · venda</span>
        {agro.carregando ? <div className="mk-skel mk-skel-linha" /> : d ? <>
          <strong>{fmt(d.valor)}</strong>
          {d.variacao != null && <span className="mk-var">{d.variacao > 0 ? "+" : ""}{d.variacao.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% sobre o dia útil anterior{d.anterior != null ? ` (${fmt(d.anterior)})` : ""}</span>}
          <span className="mk-fonte">Taxa oficial de {dataBr(d.data)} · Fonte: {d.fonte}. Não é cotação em tempo real.</span>
          {d.desatualizado && <span className="mk-aviso" role="status">Atenção: valor possivelmente desatualizado. Consultado em {dataBr(d.consultado_em, true)}.</span>}
        </> : agro.erro ? <span className="mk-aviso" role="alert">Não foi possível carregar o dólar. <button onClick={agro.recarregar}>Tentar de novo</button></span>
          : <span className="mk-vazio">Cotação do dólar indisponível no momento.</span>}
      </div>
      <p className="mk-nota">A PTAX é a taxa de referência divulgada pelo Banco Central ao fim de cada janela de apuração, não o valor negociado agora.</p>
    </div>
    <WidgetsMercado />
  </div></section>;
}

export function WidgetsMercado() {
  const [ativo, setAtivo] = useState(false);
  const [aba, setAba] = useState(0);
  const [falha, setFalha] = useState(false);
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const w = WIDGETS_AGRO[aba];
  const mover = (i: number) => { setAba(i); setFalha(false); refs.current[i]?.focus(); };
  const tecla = (e: KeyboardEvent) => {
    const n = WIDGETS_AGRO.length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); mover((aba + 1) % n); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); mover((aba - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); mover(0); }
    else if (e.key === "End") { e.preventDefault(); mover(n - 1); }
  };
  const fonteUrl = "https://www.noticiasagricolas.com.br/";
  return <div className="mk-widgets">
    <div className="mk-widgets-topo"><h3>Commodities</h3><a href={fonteUrl} target="_blank" rel="noopener noreferrer">Fonte: Notícias Agrícolas <ArrowUpRight size={14} /></a></div>
    {!ativo ? <div className="mk-consent">
      <p>As cotações de soja, milho, café e boi gordo são widgets oficiais do Notícias Agrícolas, serviço de terceiros. Ao carregar, seu navegador se conecta a esse provedor, que pode coletar dados técnicos como seu endereço IP. Nada é enviado antes do seu clique, e a escolha vale apenas para esta seção nesta visita.</p>
      <button className="ga-btn" onClick={() => setAtivo(true)}>Carregar cotações</button>
    </div> : <>
      <div className="mk-tabs" role="tablist" aria-label="Produtos" onKeyDown={tecla}>
        {WIDGETS_AGRO.map((x, i) => <button key={x.id} ref={el => { refs.current[i] = el; }} role="tab" id={`${base}-t${i}`} aria-selected={i === aba} aria-controls={`${base}-p`} tabIndex={i === aba ? 0 : -1} onClick={() => { setAba(i); setFalha(false); }}>{x.nome}</button>)}
      </div>
      <div role="tabpanel" id={`${base}-p`} aria-labelledby={`${base}-t${aba}`} className="mk-painel">
        <p className="mk-nota">{w.mercado}. Data e unidades aparecem no widget do provedor.</p>
        <iframe key={w.id} className="mk-frame" title={`Cotações de ${w.nome} · Notícias Agrícolas`} src={`/mercado-widget/${w.id}`} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" loading="lazy" referrerPolicy="no-referrer" onError={() => setFalha(true)} />
        <p className="mk-nota">Se o quadro não carregar, <a href={fonteUrl} target="_blank" rel="noopener noreferrer">abra a cotação no site do provedor</a>.{falha && " O carregamento falhou."}</p>
      </div>
      <button className="mk-desativar" onClick={() => { setAtivo(false); setFalha(false); }}>Desativar</button>
    </>}
  </div>;
}
