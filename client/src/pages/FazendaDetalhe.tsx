import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Copy, Droplets, MapPin, MessageCircle, Ruler, Share2, Sprout } from "lucide-react";
import { api, linkWhatsapp, type FazendaPublica } from "../api";
import { useSite } from "../contexto";
import { Erro } from "../components/Avisos";
import { Banner, Eyebrow } from "../components/Agrezen";
import { Caracteristicas } from "../components/Caracteristicas";
import { GaleriaFotos } from "../components/GaleriaFotos";
import { GaleriaVideos } from "../components/GaleriaVideos";
import { CartaoFazenda } from "../components/CartaoFazenda";

export default function FazendaDetalhe() {
  const {slug}=useParams();
  const {config}=useSite();
  const [f,setF]=useState<FazendaPublica|null>(null);
  const [erro,setErro]=useState<unknown>(null);
  const [outras,setOutras]=useState<FazendaPublica[]>([]);
  const [aviso,setAviso]=useState("");
  useEffect(()=>{
    let ativo=true;setF(null);setErro(null);setOutras([]);setAviso("");
    void api.get<FazendaPublica>(`/api/public/fazendas/${encodeURIComponent(slug || "")}`).then(r=>{if(ativo){setF(r);document.title=`${r.titulo} — ${config?.nome_site || "Gramogol Fazendas"}`;}}).catch(e=>{if(ativo)setErro(e);});
    void api.get("/api/public/fazendas?limite=60").then(r=>{if(ativo)setOutras(r.fazendas);}).catch(()=>{});
    return()=>{ativo=false;};
  },[slug,config?.nome_site]);
  if(erro)return <div className="ga-wrap pagina"><Erro erro={erro}/><Link to="/fazendas">Voltar às fazendas</Link></div>;
  if(!f)return <div className="ga-wrap pagina" role="status">Carregando fazenda…</div>;
  const url=window.location.href;
  const mensagem=`Olá! Tenho interesse na fazenda ${f.titulo}. Gostaria de conversar com o corretor. ${url}`;
  const wa=linkWhatsapp(f.whatsapp,mensagem);
  const copiar=async()=>{try{await navigator.clipboard.writeText(url);setAviso("Link copiado.");}catch{setAviso("Não foi possível copiar automaticamente. Copie o endereço desta página.");}};
  const compartilhar=async()=>{
    if(navigator.share){try{await navigator.share({title:f.titulo,text:`Conheça ${f.titulo}`,url});}catch(e){if((e as Error).name!=="AbortError")await copiar();}}
    else await copiar();
  };
  const score=(p:FazendaPublica)=>Number(p.regiao===f.regiao)*2+p.culturas.filter(c=>f.culturas.includes(c)).length;
  const selecionadas=outras.filter(p=>p.slug!==f.slug).sort((a,b)=>score(b)-score(a));
  const similares=selecionadas.filter(p=>score(p)>0).slice(0,3);
  const recomendadas=similares.length?similares:selecionadas.slice(0,3);
  const agua=f.atributos.find(a=>a.chave==="agua");
  return <>
    <Banner titulo={f.titulo}/>
    <section className="ga-detail"><div className="ga-wrap">
      <div className="ga-detail-heading"><div><Eyebrow>{f.destaque?"Seleção do corretor":"Propriedade rural"}</Eyebrow><h2 className="ga-title">{f.titulo}</h2><p>{[f.regiao,f.area].filter(Boolean).join(" · ")}</p></div><div className="ga-detail-actions"><button className="ga-icon-button" onClick={()=>void compartilhar()}><Share2/>Compartilhar</button><Link className="ga-icon-button" to="/fazendas"><ArrowLeft/>Todas as fazendas</Link></div></div>
      <GaleriaFotos key={f.slug} fotos={f.fotos} titulo={f.titulo}/>
      <div className="ga-property-facts">
        {[{Icon:Ruler,label:"Área",value:f.area || "Consultar"},{Icon:MapPin,label:"Região",value:f.regiao},{Icon:Sprout,label:"Vocação",value:f.culturas.join(" · ") || "Uso rural"},{Icon:Droplets,label:"Água",value:agua?.texto || "Consultar o corretor"}].map(({Icon,label,value})=><div className="ga-fact" key={label}><span className="ga-fact-icon"><Icon/></span><div><span className="ga-fact-label">{label}</span><strong>{value}</strong></div></div>)}
      </div>
      <div className="ga-detail-grid"><div className="ga-detail-main"><h3>Sobre a propriedade</h3>{f.descricao.split(/\n+/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}
        <Caracteristicas atributos={f.atributos}/><GaleriaVideos key={f.slug} videos={f.videos || []}/>
      </div><aside className="ga-sidebar"><span className="ga-price-label">Valor anunciado</span><strong className="ga-price">{f.preco || "Sob consulta"}</strong>
        {wa?<a className="ga-btn ga-btn--green" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle/>Falar com o corretor <ArrowUpRight/></a>:<><p className="ga-disclaimer">WhatsApp ainda não configurado para este anúncio.</p><Link className="ga-btn" to="/contato">Canais de atendimento <ArrowUpRight/></Link></>}
        <div className="ga-sidebar-rule"/><h4>Compartilhar propriedade</h4><div className="ga-share-row"><button className="ga-icon-button" onClick={()=>void copiar()}><Copy/>Copiar link</button><a className="ga-icon-button" href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer"><Share2/>WhatsApp</a></div>
        {aviso&&<p role="status" className="ga-disclaimer">{aviso}</p>}
        <div className="ga-broker-note">{config?.aviso_intermediacao || "Atendimento direto com o corretor. Localização detalhada, documentação e visitas são tratados em conversa privada."}{config?.texto_creci&&<p>{config.texto_creci}</p>}</div>
      </aside></div>
    </div></section>
    {recomendadas.length>0&&<section className="ga-similar"><div className="ga-wrap"><div className="ga-section-head"><div><Eyebrow>Mais propriedades</Eyebrow><h2 className="ga-section-title">{similares.length?"Fazendas semelhantes":"Outras fazendas disponíveis"}</h2></div><Link className="ga-link-arrow" to="/fazendas">Ver catálogo <ArrowRight/></Link></div><div className="ga-cards">{recomendadas.map(p=><CartaoFazenda f={p} key={p.slug}/>)}</div></div></section>}
  </>;
}
