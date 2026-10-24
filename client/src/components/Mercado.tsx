import { Link } from "react-router-dom";
import { ArrowUpRight, TrendingDown, TrendingUp, Minus, Landmark } from "lucide-react";
import type { AgroPublico, NoticiaAgro, NoticiasAgroResposta } from "../../../shared/agro";
import { dataBr, useCarga } from "../lib/agro";
import { useConteudo } from "./Conteudo";
import "./Mercado.css";

export function Seloformato({ n, compacto = false }: { n: NoticiaAgro; compacto?: boolean }) {
  return <span className={`mk-selo mk-selo--${n.formato}`}>{n.formato === "integral" ? (compacto ? "Íntegra licenciada" : "Texto integral licenciado") : (compacto ? "Resumo da matéria" : "Resumo · leia a matéria completa na fonte")}</span>;
}

export function CartaoNoticia({ n, destaque = false }: { n: NoticiaAgro; destaque?: boolean }) {
  return <article className={`mk-card${destaque ? " mk-card--destaque" : ""}`}>
    <div className="mk-meta"><span>{n.fonte_nome}</span><span>{dataBr(n.publicado_em)}</span></div>
    <h3><Link to={`/noticias/${n.slug}`}>{n.titulo}</Link></h3>
    {n.chamada && <p>{n.chamada}</p>}
    <div className="mk-card-footer"><Seloformato n={n} compacto /><span className="mk-card-acao" aria-hidden="true"><ArrowUpRight size={20} /></span></div>
  </article>;
}

export function NoticiasHome() {
  const { texto: t } = useConteudo("home");
  const agro = useCarga<AgroPublico>("/api/public/agro");
  const lista = useCarga<NoticiasAgroResposta>(agro.dados?.config.noticias_ativas ? "/api/public/noticias?pagina=1" : null);
  if (agro.dados && !agro.dados.config.noticias_ativas) return null;
  const vistas = new Set<string>();
  const itens = (lista.dados?.noticias ?? []).filter(n => {
    const chave = `${n.fonte}:${n.titulo.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  }).slice(0, 3);
  const aguardando = agro.carregando || lista.carregando || (!!agro.dados?.config.noticias_ativas && !lista.dados && !lista.erro);
  return <section className="ga-section" id="noticias" data-cms-secao="noticias"><div className="ga-wrap">
    <div className="mk-head"><div><span className="mk-kicker">{t("noticias.rotulo")}</span><h2>{t("noticias.titulo")}</h2></div><Link className="mk-mais" to="/noticias">Todas as notícias <ArrowUpRight size={16} /></Link></div>
    {t("noticias.texto") && <p className="mk-apresentacao">{t("noticias.texto")}</p>}
    {aguardando && !itens.length && <div className="mk-grid" aria-busy="true" aria-label="Carregando notícias">{[0, 1, 2].map(i => <div key={i} className="mk-card mk-skel" />)}</div>}
    {(agro.erro || lista.erro) && !lista.carregando ? <div className="mk-aviso" role="alert">Não foi possível carregar as notícias. <button onClick={() => { agro.recarregar(); lista.recarregar(); }}>Tentar de novo</button></div> : null}
    {!aguardando && !agro.erro && !lista.erro && itens.length === 0 && <p className="mk-vazio">Nenhuma notícia publicada no momento.</p>}
    {itens.length > 0 && <div className="mk-grid">{itens.map((n, i) => <CartaoNoticia key={n.id} n={n} destaque={i === 0} />)}</div>}
  </div></section>;
}

export function CotacoesHome() {
  const { texto: t } = useConteudo("home");
  const agro = useCarga<AgroPublico>("/api/public/agro");
  if (agro.dados && !agro.dados.config.cotacoes_ativas) return null;
  const d = agro.dados?.dolar ?? null;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 });
  return <section className="ga-section ga-section--cream" id="cotacoes" data-cms-secao="cotacoes"><div className="ga-wrap">
    <div className="mk-head"><div><span className="mk-kicker">{t("cotacoes.rotulo")}</span><h2>{t("cotacoes.titulo")}</h2></div></div>
    {t("cotacoes.texto") && <p className="mk-apresentacao">{t("cotacoes.texto")}</p>}
    <div className="mk-dolar">
      <div className="mk-dolar-info">
        <span className="mk-rot">Dólar PTAX · venda</span>
        {agro.carregando ? <div className="mk-skel mk-skel-linha" /> : d ? <>
          <strong>{fmt(d.valor)}</strong>
          {d.variacao != null && <span className="mk-var">{d.variacao > 0 ? <TrendingUp size={16} /> : d.variacao < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}{d.variacao > 0 ? "+" : ""}{d.variacao.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% <small>sobre o dia útil anterior{d.anterior != null ? ` (${fmt(d.anterior)})` : ""}</small></span>}
          <span className="mk-fonte">Taxa oficial de {dataBr(d.data)} · Fonte: {d.fonte}.</span>
          <div className="mk-selos"><span>USD / BRL</span><span>Referência diária</span><span>Não é tempo real</span></div>
          {d.desatualizado && <span className="mk-aviso" role="status">Atenção: valor possivelmente desatualizado. Consultado em {dataBr(d.consultado_em, true)}.</span>}
        </> : agro.erro ? <span className="mk-aviso" role="alert">Não foi possível carregar o dólar. <button onClick={agro.recarregar}>Tentar de novo</button></span>
          : <span className="mk-vazio">Cotação do dólar indisponível no momento.</span>}
      </div>
      <div className="mk-nota"><Landmark className="mk-nota-icone" size={28} aria-hidden="true" /><b>Referência do Banco Central</b><p>A PTAX é uma taxa de referência, não o dólar negociado neste instante. O valor exibido corresponde à taxa de venda na data indicada.</p></div>
    </div>
  </div></section>;
}
