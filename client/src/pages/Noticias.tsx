import { Link, useParams, useSearchParams } from "react-router-dom";
import type { NoticiasAgroResposta, NoticiaAgro } from "../../../shared/agro";
import { CartaoNoticia, Seloformato } from "../components/Mercado";
import { dataBr, useCarga } from "../lib/agro";
import { ErroApi } from "../api";
import { useConteudo } from "../components/Conteudo";

export function Noticias() {
  const { texto: t } = useConteudo("noticias");
  const [sp, setSp] = useSearchParams();
  const pagina = Math.max(1, parseInt(sp.get("pagina") || "1", 10) || 1);
  const { dados, erro, carregando, recarregar } = useCarga<NoticiasAgroResposta>(`/api/public/noticias?pagina=${pagina}`);
  const ir = (p: number) => { setSp(p > 1 ? { pagina: String(p) } : {}); window.scrollTo(0, 0); };
  return <div className="container pagina"><main className="ga-wrap" style={{ paddingBlock: 40 }}>
    <div className="mk-head"><div><span className="mk-kicker">{t("topo.rotulo")}</span><h1>{t("topo.titulo")}</h1></div></div>
    <p className="mk-nota" style={{ marginBottom: 24 }}>{t("topo.texto")}</p>
    {carregando && <div className="mk-grid" aria-busy="true">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="mk-card mk-skel" />)}</div>}
    {erro != null && !carregando && <div className="mk-aviso" role="alert">Não foi possível carregar as notícias. <button onClick={recarregar}>Tentar de novo</button></div>}
    {dados && !carregando && (dados.noticias.length === 0
      ? <p className="mk-vazio">{pagina > 1 ? "Esta página não tem notícias." : "Nenhuma notícia publicada no momento."}</p>
      : <div className="mk-grid">{dados.noticias.map(n => <CartaoNoticia key={n.id} n={n} />)}</div>)}
    {dados && dados.paginas > 1 && <nav className="mk-pag" aria-label="Paginação">
      <button className="ga-btn" disabled={pagina <= 1} onClick={() => ir(pagina - 1)}>Anterior</button>
      <span>Página {dados.pagina} de {dados.paginas}</span>
      <button className="ga-btn" disabled={pagina >= dados.paginas} onClick={() => ir(pagina + 1)}>Próxima</button>
    </nav>}
  </main></div>;
}

export function Noticia() {
  const { slug = "" } = useParams();
  const { dados, erro, carregando, recarregar } = useCarga<{ noticia: NoticiaAgro }>(`/api/public/noticias/${encodeURIComponent(slug)}`);
  const n = dados?.noticia;
  if (carregando) return <div className="container pagina"><div className="mk-artigo" aria-busy="true"><div className="mk-skel mk-card" /></div></div>;
  if (erro != null || !n) {
    const nao = erro instanceof ErroApi && erro.status === 404;
    return <div className="container pagina"><div className="mk-artigo"><h1>{nao ? "Notícia não encontrada" : "Não foi possível carregar"}</h1>
      {!nao && <p><button className="ga-btn" onClick={recarregar}>Tentar de novo</button></p>}
      <p><Link to="/noticias">Ver todas as notícias</Link></p></div></div>;
  }
  const resumo = n.formato === "resumo";
  return <div className="container pagina"><article className="mk-artigo" style={{ paddingBlock: 40 }}>
    <p><Link to="/noticias">Notícias do agro</Link></p>
    <Seloformato n={n} />
    <h1>{n.titulo}</h1>
    {n.chamada && <p><strong>{n.chamada}</strong></p>}
    {!resumo && n.resumo_fonte && <p>{n.resumo_fonte}</p>}
    {!resumo && n.resumo && n.resumo !== n.resumo_fonte && <aside className="mk-aviso"><strong>Apresentação da Gramogol:</strong> {n.resumo}</aside>}
    <div className="mk-fonte-caixa">
      <span>Publicado por: <strong>{n.fonte_nome}</strong></span>
      {n.autor && <span>Autoria: {n.autor}</span>}
      <span>Data: {dataBr(n.publicado_em)}</span>
      {n.licenca && <span>Licença: {n.licenca}</span>}
      <a href={n.fonte_url} target="_blank" rel="noopener noreferrer">Ler o original em {n.fonte_nome}</a>
    </div>
    {resumo ? <>
      <div className="mk-aviso" role="note">{n.resumo === n.resumo_fonte ? `Trecho de apresentação disponibilizado por ${n.fonte_nome} via RSS.` : "Resumo editorial da Gramogol."} Não é o texto completo da matéria. Para ler a íntegra, acesse a fonte original.</div>
      <div className="mk-corpo">{n.resumo ? <p>{n.resumo}</p> : <p className="mk-vazio">Resumo indisponível.</p>}</div>
      <p><a className="ga-btn" href={n.fonte_url} target="_blank" rel="noopener noreferrer">Ler matéria completa na fonte</a></p>
    </> : <div className="mk-corpo">
      {n.corpo.length ? n.corpo.map((p, i) => <p key={i}>{p}</p>) : <p className="mk-vazio">Texto indisponível. <a href={n.fonte_url} target="_blank" rel="noopener noreferrer">Leia no original</a>.</p>}
    </div>}
  </article></div>;
}
