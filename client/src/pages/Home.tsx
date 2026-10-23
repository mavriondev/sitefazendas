import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Droplets, Leaf, MapPin, ShieldCheck, Wheat } from "lucide-react";
import { api, linkWhatsapp, type FazendaPublica } from "../api";
import { useSite } from "../contexto";
import type { SlideItem } from "../components/Slider";
import { CartaoFazenda } from "../components/CartaoFazenda";
import { BuscaRapida } from "../components/BuscaRapida";
import { Botanical, Eyebrow, Seals } from "../components/Agrezen";
import { Secoes, useConteudo, LinkConteudo, fundoConteudo } from "../components/Conteudo";

export default function Home() {
  const {config} = useSite();
  const {texto:t}=useConteudo("home");
  const {texto:g}=useConteudo("global");
  const [dados,setDados] = useState<{slides: SlideItem[];destaques: FazendaPublica[]}|null>(null);
  const [erro,setErro] = useState(false);
  const [parceiros,setParceiros] = useState<Array<{id:number;nome:string;logo:string|null;url:string|null}>>([]);
  const [indice,setIndice] = useState(0);
  const [pausa,setPausa] = useState(false);
  useEffect(()=>{
    let ativo=true;
    void api.get("/api/public/home").then(r=>{if(ativo)setDados(r);}).catch(()=>{if(ativo)setErro(true);});
    void api.get("/api/public/parceiros").then(r=>{if(ativo)setParceiros(r.parceiros);}).catch(()=>{});
    return()=>{ativo=false;};
  },[config?.nome_site]);
  const quantidade=dados?.slides.length || 0;
  useEffect(()=>{
    if(quantidade<2 || pausa || window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const t=window.setInterval(()=>setIndice(i=>(i+1)%quantidade),6000);
    return()=>window.clearInterval(t);
  },[quantidade,pausa]);
  const slide=quantidade?dados!.slides[indice%quantidade]:null;
  const zap=linkWhatsapp(config?.whatsapp_padrao,"Olá! Gostaria de conversar sobre fazendas à venda.");
  return <Secoes pagina="home" blocos={{
    hero:<section className="ga-hero" data-cms-secao="hero" aria-label="Fazendas em apresentação" aria-roledescription={quantidade>1?"carrossel":undefined} onMouseEnter={()=>setPausa(true)} onMouseLeave={()=>setPausa(false)} onFocus={()=>setPausa(true)} onBlur={()=>setPausa(false)}>
      {(slide?.imagem || t("hero.imagem")) && <img className="ga-hero-photo" src={slide?.imagem || t("hero.imagem")} alt=""/>}
      <div className="ga-wrap ga-hero-content"><div className="ga-hero-copy">
        <Eyebrow>{t("hero.rotulo")} · {config?.nome_site || "Gramogol"}</Eyebrow>
        <h1 className="ga-title">{slide?.titulo || config?.hero_titulo || <>Terra boa.<br/>Negócios de confiança.</>}</h1>
        <p>{slide?.subtitulo || config?.hero_subtitulo || "Propriedades rurais selecionadas e uma conversa direta com o corretor — com discrição desde o primeiro contato."}</p>
        <div className="ga-hero-actions"><LinkConteudo className="ga-btn" href={slide?.link || t("hero.link")}>{slide?.link?(slide.link.startsWith("/")?t("hero.botao_slide"):t("hero.botao_externo")):t("hero.botao")} <ArrowUpRight/></LinkConteudo>
          <LinkConteudo className="ga-btn ga-btn--glass" href={t("hero.link_sobre")}>{t("hero.botao_sobre")} <ArrowUpRight/></LinkConteudo>
        </div></div><Seals/>
      </div><Botanical/>
      {!slide?.imagem && <span className="ga-hero-note">{t("hero.legenda")}</span>}
      {quantidade>1 && <div className="ga-hero-controls"><button aria-label="Slide anterior" onClick={()=>setIndice(i=>(i-1+quantidade)%quantidade)}><ArrowLeft/></button><span>{indice%quantidade+1} / {quantidade}</span><button aria-label="Próximo slide" onClick={()=>setIndice(i=>(i+1)%quantidade)}><ArrowRight/></button><button onClick={()=>setPausa(v=>!v)} aria-label={pausa?"Reproduzir apresentação":"Pausar apresentação"}>{pausa?"Reproduzir":"Pausar"}</button></div>}
    </section>,
    busca:<BuscaRapida/>,
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
