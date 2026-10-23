import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { AgroPublico, NoticiaAgro, NoticiasAgroResposta } from "../../../shared/agro";
import { dataBr, useCarga } from "../lib/agro";
import { useConteudo } from "./Conteudo";
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
  const { texto: t } = useConteudo("home");
  const agro = useCarga<AgroPublico>("/api/public/agro");
  const lista = useCarga<NoticiasAgroResposta>(agro.dados?.config.noticias_ativas ? "/api/public/noticias?pagina=1" : null);
  if (agro.dados && !agro.dados.config.noticias_ativas) return null;
  const itens = lista.dados?.noticias.slice(0, 3) ?? [];
  return <section className="ga-section" id="noticias" data-cms-secao="noticias"><div className="ga-wrap">
    <div className="mk-head"><div><span className="mk-kicker">{t("noticias.rotulo")}</span><h2>{t("noticias.titulo")}</h2></div><Link className="mk-mais" to="/noticias">Todas as notícias <ArrowUpRight size={16} /></Link></div>
    {t("noticias.texto") && <p className="mk-apresentacao">{t("noticias.texto")}</p>}
    {(agro.carregando || lista.carregando) && <div className="mk-grid" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="mk-card mk-skel" />)}</div>}
    {(agro.erro || lista.erro) && !lista.carregando ? <div className="mk-aviso" role="alert">Não foi possível carregar as notícias. <button onClick={() => { agro.recarregar(); lista.recarregar(); }}>Tentar de novo</button></div> : null}
    {!lista.carregando && !agro.erro && !lista.erro && itens.length === 0 && <p className="mk-vazio">Nenhuma notícia publicada no momento.</p>}
    {itens.length > 0 && <div className="mk-grid">{itens.map(n => <CartaoNoticia key={n.id} n={n} />)}</div>}
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
          {d.variacao != null && <span className="mk-var">{d.variacao > 0 ? "+" : ""}{d.variacao.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% sobre o dia útil anterior{d.anterior != null ? ` (${fmt(d.anterior)})` : ""}</span>}
          <span className="mk-fonte">Taxa oficial de {dataBr(d.data)} · Fonte: {d.fonte}. Não é cotação em tempo real.</span>
          {d.desatualizado && <span className="mk-aviso" role="status">Atenção: valor possivelmente desatualizado. Consultado em {dataBr(d.consultado_em, true)}.</span>}
        </> : agro.erro ? <span className="mk-aviso" role="alert">Não foi possível carregar o dólar. <button onClick={agro.recarregar}>Tentar de novo</button></span>
          : <span className="mk-vazio">Cotação do dólar indisponível no momento.</span>}
      </div>
      <p className="mk-nota">A PTAX é a taxa de referência divulgada pelo Banco Central ao fim de cada janela de apuração, não o valor negociado agora.</p>
    </div>
  </div></section>;
}
