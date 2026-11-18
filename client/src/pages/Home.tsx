import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Droplets, Leaf, MapPin, ShieldCheck, Wheat } from "lucide-react";
import { api, linkWhatsapp, type FazendaPublica } from "../api";
import { useSite, useParceiros } from "../contexto";
import { CartaoFazenda } from "../components/CartaoFazenda";
import { BuscaRapida } from "../components/BuscaRapida";
import { Eyebrow } from "../components/Agrezen";
import { NoticiasHome, CotacoesHome } from "../components/Mercado";
import { Secoes, useConteudo, LinkConteudo, fundoConteudo } from "../components/Conteudo";

export default function Home() {
  const {config} = useSite();
  const {texto:t}=useConteudo("home");
  const {texto:g}=useConteudo("global");
  const [dados,setDados] = useState<{destaques: FazendaPublica[]}|null>(null);
  const [erro,setErro] = useState(false);
  const { parceiros } = useParceiros();
  useEffect(()=>{
    let ativo=true;
    void api.get("/api/public/home").then(r=>{if(ativo)setDados(r);}).catch(()=>{if(ativo)setErro(true);});
    return()=>{ativo=false;};
  },[config?.nome_site]);
  const zap=linkWhatsapp(config?.whatsapp_padrao,"Olá! Gostaria de conversar sobre fazendas à venda.");
  return <Secoes pagina="home" blocos={{
    hero:<section className="ga-home-intro" data-cms-secao="hero" aria-label="Fazendas à venda">
      <div className="ga-wrap">
        <h1>{config?.hero_titulo || "Encontre sua próxima fazenda"}</h1>
        <p>{config?.hero_subtitulo || "Conheça as fazendas disponíveis e veja os detalhes de cada imóvel."}</p>
      </div>
    </section>,
    busca:<BuscaRapida/>,
    noticias:<NoticiasHome/>,
    cotacoes:<CotacoesHome/>,
    destaques:<section className="ga-section" id="fazendas" data-cms-secao="destaques"><div className="ga-wrap">
      <div className="ga-section-head"><div><Eyebrow>{t("destaques.rotulo")}</Eyebrow><h2 className="ga-section-title">{t("destaques.titulo")}</h2></div><LinkConteudo className="ga-link-arrow" href={t("destaques.link")}>{t("destaques.botao")} <ArrowRight/></LinkConteudo></div>
      {erro?<div role="alert" className="msg erro">Não foi possível carregar os anúncios. <Link to="/fazendas">Consultar catálogo</Link></div>:!dados?<p role="status">Carregando fazendas…</p>:dados.destaques.length?<div className="ga-cards">{dados.destaques.map(f=><CartaoFazenda key={f.slug} f={f}/>)}</div>:<div className="vazio"><h3>{t("destaques.vazio_titulo")}</h3><p>{t("destaques.vazio_texto")}</p><LinkConteudo className="ga-btn" href={t("destaques.link")}>{t("destaques.botao")} <ArrowUpRight/></LinkConteudo></div>}
    </div></section>,
    sobre:<section className="ga-section ga-section--cream" id="sobre" data-cms-secao="sobre"><div className="ga-wrap ga-split">
      <div className="ga-split-art">{t("sobre.imagem")&&<img className="ga-split-main" src={t("sobre.imagem")} alt="Apresentação da empresa" loading="lazy"/>}{t("sobre.imagem_menor")&&<img className="ga-split-inset" src={t("sobre.imagem_menor")} alt="" loading="lazy"/>}<span className="ga-seal-float"><Leaf/></span><small className="ga-art-credit">{g("marca.credito_imagens")}</small></div>
      <div className="ga-split-copy"><Eyebrow>{t("sobre.rotulo")}</Eyebrow><h2 className="ga-section-title">{config?.sobre_titulo || "Cada negociação começa com uma boa conversa."}</h2>
        <p>{config?.sobre_texto ? config.sobre_texto.split(/\n{2,}/)[0] : "A Gramogol aproxima produtores e compradores de terras rurais com atendimento pessoal e respeito ao sigilo."}</p>
        <div className="ga-benefits">{[ShieldCheck,Droplets,Wheat,MapPin].map((Icon,n)=><div className="ga-benefit" key={n}><span className="ga-seal-icon"><Icon/></span>{t(`sobre.beneficio${n+1}`)}</div>)}</div>
        <LinkConteudo className="ga-btn ga-btn--green" href={t("sobre.link")}>{t("sobre.botao")} <ArrowUpRight/></LinkConteudo>
      </div>
    </div></section>,
    etapas:<section className="ga-step-band" data-cms-secao="etapas"><div className="ga-wrap"><div className="ga-section-head"><div><Eyebrow>{t("etapas.rotulo")}</Eyebrow><h2 className="ga-section-title">{t("etapas.titulo")}</h2></div></div>
      <div className="ga-steps">{[1,2,3].map(n=><article className="ga-step" key={n}><span className="ga-step-no">0{n}</span><h3>{t(`etapas.titulo${n}`)}</h3><p>{t(`etapas.texto${n}`)}</p></article>)}</div>
    </div></section>,
    venda:<section className="ga-section" id="venda" data-cms-secao="venda"><div className="ga-wrap ga-split">
      <div className="ga-split-copy"><Eyebrow>{t("venda.rotulo")}</Eyebrow><h2 className="ga-section-title">{t("venda.titulo")}</h2><p>{t("venda.texto")}</p><LinkConteudo className="ga-btn" href={t("venda.link")}>{t("venda.botao")} <ArrowUpRight/></LinkConteudo></div>
      <div className="ga-split-art">{t("venda.imagem")&&<img className="ga-split-main" src={t("venda.imagem")} alt="Apresentação da venda de imóveis" loading="lazy"/>}{t("venda.imagem_menor")&&<img className="ga-split-inset" src={t("venda.imagem_menor")} alt="" loading="lazy"/>}<span className="ga-seal-float"><Wheat/></span><small className="ga-art-credit">{g("marca.credito_imagens")}</small></div>
    </div></section>,
    parceiros:parceiros.length>0 && <section className="ga-section ga-section--cream" id="parceiros" data-cms-secao="parceiros"><div className="ga-wrap"><div className="ga-section-head"><div><Eyebrow>{t("parceiros.rotulo")}</Eyebrow><h2 className="ga-section-title">{t("parceiros.titulo")}</h2></div><LinkConteudo className="ga-link-arrow" href={t("parceiros.link")}>{t("parceiros.botao")} <ArrowRight/></LinkConteudo></div>
      <div className="parceiros-faixa">{parceiros.slice(0,8).map(p=>p.url?<a className="parceiro-mini" href={p.url} key={p.id} target="_blank" rel="noopener noreferrer">{p.logo?<img src={p.logo} alt={p.nome} loading="lazy"/>:p.nome}</a>:<div className="parceiro-mini" key={p.id}>{p.logo?<img src={p.logo} alt={p.nome} loading="lazy"/>:p.nome}</div>)}</div>
    </div></section>,
    convite:<section className="ga-dark-cta cms-fundo" data-cms-secao="convite" style={fundoConteudo(t("convite.imagem"))}><div className="ga-wrap"><div><Eyebrow>{t("convite.rotulo")}</Eyebrow><h2 className="ga-section-title">{t("convite.titulo")}</h2><p>{t("convite.texto")}</p></div>{zap?<a className="ga-btn" href={zap} target="_blank" rel="noopener noreferrer">{t("convite.botao")} <ArrowUpRight/></a>:<LinkConteudo className="ga-btn" href={t("convite.link_alternativo")}>{t("convite.botao_alternativo")} <ArrowUpRight/></LinkConteudo>}</div></section>,
  }}/>;
}
