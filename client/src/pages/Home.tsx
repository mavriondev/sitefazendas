import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Droplets, Leaf, MapPin, ShieldCheck, Wheat } from "lucide-react";
import { api, linkWhatsapp, type FazendaPublica } from "../api";
import { useSite } from "../contexto";
import type { SlideItem } from "../components/Slider";
import { CartaoFazenda } from "../components/CartaoFazenda";
import { BuscaRapida } from "../components/BuscaRapida";
import { Botanical, Eyebrow, IMAGENS, Seals } from "../components/Agrezen";

export default function Home() {
  const {config} = useSite();
  const [dados,setDados] = useState<{slides: SlideItem[];destaques: FazendaPublica[]}|null>(null);
  const [erro,setErro] = useState(false);
  const [parceiros,setParceiros] = useState<Array<{id:number;nome:string;logo:string|null;url:string|null}>>([]);
  const [indice,setIndice] = useState(0);
  const [pausa,setPausa] = useState(false);
  useEffect(()=>{
    let ativo=true;
    document.title=config?.nome_site || "Gramogol Fazendas";
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
  return <>
    <section className="ga-hero" aria-label="Fazendas em apresentação" aria-roledescription={quantidade>1?"carrossel":undefined} onMouseEnter={()=>setPausa(true)} onMouseLeave={()=>setPausa(false)} onFocus={()=>setPausa(true)} onBlur={()=>setPausa(false)}>
      <img className="ga-hero-photo" src={slide?.imagem || IMAGENS+"cerrado-soja-aerea.jpg"} alt=""/>
      <div className="ga-wrap ga-hero-content"><div className="ga-hero-copy">
        <Eyebrow>Fazendas à venda · {config?.nome_site || "Gramogol"}</Eyebrow>
        <h1 className="ga-title">{slide?.titulo || config?.hero_titulo || <>Terra boa.<br/>Negócios de confiança.</>}</h1>
        <p>{slide?.subtitulo || config?.hero_subtitulo || "Propriedades rurais selecionadas e uma conversa direta com o corretor — com discrição desde o primeiro contato."}</p>
        <div className="ga-hero-actions">{slide?.link && !slide.link.startsWith("/") ? <a className="ga-btn" href={slide.link} rel="noopener noreferrer">Saiba mais <ArrowUpRight/></a> : <Link className="ga-btn" to={slide?.link || "/fazendas"}>{slide?.link?"Conhecer propriedade":"Explorar fazendas"} <ArrowUpRight/></Link>}
          <Link className="ga-btn ga-btn--glass" to="/sobre">Conheça a Gramogol <ArrowUpRight/></Link>
        </div></div><Seals/>
      </div><Botanical/>
      {!slide?.imagem && <span className="ga-hero-note">Imagem ilustrativa</span>}
      {quantidade>1 && <div className="ga-hero-controls"><button aria-label="Slide anterior" onClick={()=>setIndice(i=>(i-1+quantidade)%quantidade)}><ArrowLeft/></button><span>{indice%quantidade+1} / {quantidade}</span><button aria-label="Próximo slide" onClick={()=>setIndice(i=>(i+1)%quantidade)}><ArrowRight/></button><button onClick={()=>setPausa(v=>!v)} aria-label={pausa?"Reproduzir apresentação":"Pausar apresentação"}>{pausa?"Reproduzir":"Pausar"}</button></div>}
    </section>
    <BuscaRapida/>
    <section className="ga-section" id="fazendas"><div className="ga-wrap">
      <div className="ga-section-head"><div><Eyebrow>Portfólio rural</Eyebrow><h2 className="ga-section-title">Fazendas em destaque</h2></div><Link className="ga-link-arrow" to="/fazendas">Ver catálogo <ArrowRight/></Link></div>
      {erro?<div role="alert" className="msg erro">Não foi possível carregar os anúncios. <Link to="/fazendas">Consultar catálogo</Link></div>:!dados?<p role="status">Carregando fazendas…</p>:dados.destaques.length?<div className="ga-cards">{dados.destaques.map(f=><CartaoFazenda key={f.slug} f={f}/>)}</div>:<div className="vazio"><h3>Nenhuma fazenda em destaque no momento</h3><p>Consulte o catálogo para ver as propriedades disponíveis.</p><Link className="ga-btn" to="/fazendas">Ver fazendas <ArrowUpRight/></Link></div>}
    </div></section>
    <section className="ga-section ga-section--cream" id="sobre"><div className="ga-wrap ga-split">
      <div className="ga-split-art"><img className="ga-split-main" src={IMAGENS+"sede-fazenda.jpg"} alt="Sede rural ilustrativa" loading="lazy"/><img className="ga-split-inset" src={IMAGENS+"represa.jpg"} alt="Represa ilustrativa" loading="lazy"/><span className="ga-seal-float"><Leaf/></span><small className="ga-art-credit">Imagens ilustrativas</small></div>
      <div className="ga-split-copy"><Eyebrow>Intermediação próxima</Eyebrow><h2 className="ga-section-title">{config?.sobre_titulo || "Cada negociação começa com uma boa conversa."}</h2>
        <p>{config?.sobre_texto ? config.sobre_texto.split(/\n{2,}/)[0] : "A Gramogol aproxima produtores e compradores de terras rurais com atendimento pessoal e respeito ao sigilo."}</p>
        <div className="ga-benefits">{[{Icon:ShieldCheck,t:"Sigilo respeitado"},{Icon:Droplets,t:"Dados com origem"},{Icon:Wheat,t:"Vocação da terra"},{Icon:MapPin,t:"Região aproximada"}].map(({Icon,t})=><div className="ga-benefit" key={t}><span className="ga-seal-icon"><Icon/></span>{t}</div>)}</div>
        <Link className="ga-btn ga-btn--green" to="/sobre">Como trabalhamos <ArrowUpRight/></Link>
      </div>
    </div></section>
    <section className="ga-step-band"><div className="ga-wrap"><div className="ga-section-head"><div><Eyebrow>Atendimento direto</Eyebrow><h2 className="ga-section-title">Compra séria começa com conversa direta.</h2></div></div>
      <div className="ga-steps">{[
        ["01","Navegue com discrição","Consulte as propriedades e as informações liberadas para o público, sem expor sua identidade."],
        ["02","Peça os detalhes","Uma propriedade chamou sua atenção? Converse com o corretor sobre os dados complementares."],
        ["03","Conheça com segurança","O corretor acompanha a conversa, a visita e os próximos passos da negociação."]
      ].map(([n,t,p])=><article className="ga-step" key={n}><span className="ga-step-no">{n}</span><h3>{t}</h3><p>{p}</p></article>)}</div>
    </div></section>
    <section className="ga-section" id="venda"><div className="ga-wrap ga-split">
      <div className="ga-split-copy"><Eyebrow>Venda sua fazenda</Eyebrow><h2 className="ga-section-title">A propriedade certa merece a conversa certa.</h2><p>Quer apresentar uma fazenda ao mercado? Fale com a equipe para entender a intermediação e quais informações podem ser divulgadas.</p><Link className="ga-btn" to="/venda-sua-fazenda">Conversar sobre venda <ArrowUpRight/></Link></div>
      <div className="ga-split-art"><img className="ga-split-main" src={IMAGENS+"silos-armazem.jpg"} alt="Estrutura rural ilustrativa" loading="lazy"/><img className="ga-split-inset" src={IMAGENS+"lavoura-milho.jpg"} alt="Lavoura ilustrativa" loading="lazy"/><span className="ga-seal-float"><Wheat/></span><small className="ga-art-credit">Imagens ilustrativas</small></div>
    </div></section>
    {parceiros.length>0 && <section className="ga-section ga-section--cream" id="parceiros"><div className="ga-wrap"><div className="ga-section-head"><div><Eyebrow>Rede de parceiros</Eyebrow><h2 className="ga-section-title">Conhecimento que soma à negociação.</h2></div><Link className="ga-link-arrow" to="/parceiros">Ver parceiros <ArrowRight/></Link></div>
      <div className="parceiros-faixa">{parceiros.slice(0,8).map(p=>p.url?<a className="parceiro-mini" href={p.url} key={p.id} target="_blank" rel="noopener noreferrer">{p.logo?<img src={p.logo} alt={p.nome} loading="lazy"/>:p.nome}</a>:<div className="parceiro-mini" key={p.id}>{p.logo?<img src={p.logo} alt={p.nome} loading="lazy"/>:p.nome}</div>)}</div>
    </div></section>}
    <section className="ga-dark-cta"><div className="ga-wrap"><div><Eyebrow>Gramogol Fazendas</Eyebrow><h2 className="ga-section-title">Terra, propósito e uma negociação bem conduzida.</h2><p>Atendimento pessoal para comprar ou vender sua propriedade rural, com discrição do primeiro contato ao fechamento.</p></div>{zap?<a className="ga-btn" href={zap} target="_blank" rel="noopener noreferrer">Falar com o corretor <ArrowUpRight/></a>:<Link className="ga-btn" to="/contato">Falar com a equipe <ArrowUpRight/></Link>}</div></section>
  </>;
}
