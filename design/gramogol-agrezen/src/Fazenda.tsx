import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, ChartNoAxesCombined, ChevronLeft, ChevronRight, CirclePlay, CloudRain, Copy, Droplets, House, Info, LandPlot, Layers, MapPin, Mountain, MoveUpRight, Route, Ruler, Share2, Sprout, Sun, Zap } from "lucide-react";
import { Eyebrow, FarmCard, FontLoad, Footer, Header, IMG, PAGE_HOME, WhatsAppUnavailable } from "./_shared/Shared";

const photos = [
  { src:"cerrado-soja-aerea.jpg", caption:"Vista aérea da área agrícola" },
  { src:"represa.jpg", caption:"Recurso hídrico ilustrativo" },
  { src:"sede-fazenda.jpg", caption:"Estrutura rural ilustrativa" },
  { src:"grao-mogol-serra.jpg", caption:"Paisagem regional ilustrativa" },
];
const details = [
  { title:"Água", value:"Represa e cursos d’água", source:"Informação ilustrativa do anúncio", icon:Droplets, status:"Indicado por fonte pública" },
  { title:"Altitude", value:"Faixa aproximada 720–860 m", source:"Modelo de terreno — demonstração", icon:Mountain, status:"Indicado por fonte pública" },
  { title:"Argila no solo", value:"Textura média a argilosa", source:"Descrição ilustrativa", icon:Layers, status:"Indicado por fonte pública" },
  { title:"Relevo", value:"Predominantemente suave", source:"Caracterização ilustrativa", icon:ChartNoAxesCombined, status:"Confirmado pelo corretor" },
  { title:"Precipitação", value:"Consultar série local", source:"Dado não verificado nesta prévia", icon:CloudRain, status:"Indicado por fonte pública" },
  { title:"Energia", value:"Rede rural nas proximidades", source:"Descrição ilustrativa", icon:Zap, status:"Confirmado pelo corretor" },
  { title:"Benfeitorias", value:"Sede e apoio operacional", source:"Descrição ilustrativa", icon:House, status:"Confirmado pelo corretor" },
  { title:"Uso do solo", value:"Lavoura e pecuária", source:"Vocação ilustrativa", icon:LandPlot, status:"Confirmado pelo corretor" },
  { title:"Logística", value:"Acesso por estrada rural", source:"Referência regional, sem rota", icon:Route, status:"Indicado por fonte pública" },
];

export function Fazenda() {
  const [photo,setPhoto]=useState(0);
  const [gallery,setGallery]=useState(false);
  const [video,setVideo]=useState(false);
  const [copied,setCopied]=useState(false);
  const [notice,setNotice]=useState("");
  const next=()=>setPhoto(i=>(i+1)%photos.length);
  const prev=()=>setPhoto(i=>(i+photos.length-1)%photos.length);
  useEffect(()=>{
    if(!gallery) return;
    const handle=(e:KeyboardEvent)=>{if(e.key==="Escape")setGallery(false);if(e.key==="ArrowRight")next();if(e.key==="ArrowLeft")prev();};
    window.addEventListener("keydown",handle);
    return()=>window.removeEventListener("keydown",handle);
  },[gallery]);
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title:"Horizonte do Cerrado · Gramogol Fazendas", text:"Veja esta propriedade rural demonstrativa.", url:window.location.href });
        return;
      } catch { return; /* compartilhamento cancelado pelo usuário */ }
    }
    await copyLink();
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href);setCopied(true);setNotice("Link copiado para compartilhar.");window.setTimeout(()=>{setCopied(false);setNotice("");},2500); }
    catch { setNotice("Não foi possível copiar automaticamente. Copie o endereço desta página.");window.setTimeout(()=>setNotice(""),3500); }
  };
  return <main className="gramogol-agrezen">
    <FontLoad />
    <Header active="Fazendas"/>
    <section className="ga-page-banner"><div className="ga-wrap"><h1 className="ga-title">Horizonte do Cerrado</h1><p className="ga-breadcrumb"><a href={PAGE_HOME}>Início</a>　›　<a href={PAGE_HOME+"#fazendas"}>Fazendas</a>　›　Horizonte do Cerrado</p></div></section>
    <section className="ga-detail"><div className="ga-wrap">
      <div className="ga-detail-heading"><div><Eyebrow>Seleção do corretor · Catálogo demonstrativo</Eyebrow><h2 className="ga-title">Horizonte do Cerrado</h2><p>Norte de Minas · região aproximada de Grão Mogol · 1.240 ha</p></div>
        <div className="ga-detail-actions"><button type="button" className="ga-icon-button" onClick={share}><Share2 />{copied?"Link copiado":"Compartilhar"}</button><a className="ga-icon-button" href={PAGE_HOME}><ArrowLeft/> Todas as fazendas</a></div>
      </div>
      {notice && <p role="status" className="ga-disclaimer">{notice}</p>}
      <div className="ga-gallery" aria-label="Galeria ilustrativa da propriedade">
        <button type="button" className="ga-gallery-main" onClick={()=>{setPhoto(0);setGallery(true);}} aria-label="Ampliar vista aérea">
          <img src={`${IMG}${photos[0].src}`} alt={photos[0].caption}/><span className="ga-gallery-open"><MoveUpRight/></span><span className="ga-photo-caption">{photos[0].caption}</span>
        </button>
        {photos.slice(1,3).map((p,i)=><button type="button" key={p.src} onClick={()=>{setPhoto(i+1);setGallery(true);}} aria-label={`Ampliar ${p.caption}`}>
          <img src={`${IMG}${p.src}`} alt={p.caption}/><span className="ga-photo-caption">{p.caption}</span>
        </button>)}
      </div>
      <p className="ga-photo-credit">Todas as imagens são ilustrativas, geradas para demonstração; não representam propriedade real.</p>
      <div className="ga-property-facts">
        <div className="ga-fact"><span className="ga-fact-icon"><Ruler/></span><div><span className="ga-fact-label">Área</span><strong>1.240 ha</strong></div></div>
        <div className="ga-fact"><span className="ga-fact-icon"><MapPinIcon/></span><div><span className="ga-fact-label">Região</span><strong>Norte de Minas</strong></div></div>
        <div className="ga-fact"><span className="ga-fact-icon"><Sprout/></span><div><span className="ga-fact-label">Vocação</span><strong>Agricultura e pecuária</strong></div></div>
        <div className="ga-fact"><span className="ga-fact-icon"><Droplets/></span><div><span className="ga-fact-label">Água</span><strong>Consultar detalhes</strong></div></div>
        <div className="ga-fact"><span className="ga-fact-icon"><Sun/></span><div><span className="ga-fact-label">Referência</span><strong>Região aproximada</strong></div></div>
      </div>

      <div className="ga-detail-grid">
        <div className="ga-detail-main">
          <h3>Sobre a propriedade</h3>
          <p>Propriedade rural de perfil produtivo na região de Grão Mogol, no Norte de Minas. A apresentação pública reúne informações gerais sobre área, vocação e infraestrutura, preservando a localização exata e os dados do proprietário.</p>
          <p>Os detalhes completos, documentos e condições de visita são tratados diretamente com o corretor. Este anúncio é uma composição demonstrativa: a fazenda, os dados e as imagens não correspondem a uma oferta real.</p>
          <div className="ga-data-panel"><h3>Características da terra</h3>
            <div className="ga-data-grid">{details.map(({title,value,source,icon:Icon,status})=><article className="ga-data-item" key={title}>
              <span className="ga-data-icon"><Icon/></span><label>{title}</label><strong>{value}</strong><small className="ga-source">{source}</small>
              <span className="ga-status">{status.startsWith("Confirmado") ? <BadgeCheck/> : <Info/>}{status}</span>
            </article>)}</div>
            <p className="ga-data-legend">“Confirmado pelo corretor” descreve uma checagem demonstrativa. “Indicado por fonte pública” não equivale a medição em campo nem garante condição atual. Estes dados são ilustrativos e precisam ser validados.</p>
          </div>
          <div className="ga-video"><h3>Galeria de vídeos</h3><div className="ga-video-list">{[
            {image:"cerrado-soja-aerea.jpg",title:"Sobrevoo da propriedade"},
            {image:"sede-fazenda.jpg",title:"Sede e infraestrutura"}
          ].map(v=><div className="ga-video-preview" key={v.title}>
            <img src={`${IMG}${v.image}`} alt="Imagem ilustrativa para apresentação de vídeo"/><button type="button" aria-label={`Ver aviso de demonstração: ${v.title}`} onClick={()=>setVideo(true)}><CirclePlay/></button><span>{v.title} · Prévia YouTube</span>
          </div>)}</div><p className="ga-disclaimer">Espaço para vídeos do YouTube incorporados na página. Nenhum link real foi fornecido; estas prévias não reproduzem vídeos.</p></div>
        </div>
        <aside className="ga-sidebar">
          <span className="ga-price-label">Valor anunciado</span><strong className="ga-price">Sob consulta</strong>
          <WhatsAppUnavailable title="Horizonte do Cerrado"/>
          <div className="ga-sidebar-rule"/>
          <h4>Compartilhar propriedade</h4><div className="ga-share-row"><button type="button" className="ga-icon-button" onClick={copyLink}><Copy/>{copied?"Copiado":"Copiar link"}</button><button type="button" className="ga-icon-button" onClick={share}><Share2/>Compartilhar</button></div>
          <div className="ga-broker-note">Atendimento direto com o corretor. Localização detalhada, documentação e visitas são tratados em conversa privada. CRECI não informado nesta prévia.</div>
        </aside>
      </div>
    </div></section>
    <section className="ga-similar"><div className="ga-wrap"><div className="ga-section-head"><div><Eyebrow>Mais propriedades</Eyebrow><h2 className="ga-section-title">Fazendas semelhantes</h2></div><a href={PAGE_HOME+"#fazendas"} className="ga-link-arrow">Ver catálogo <ArrowRight/></a></div><div className="ga-cards">
      <FarmCard title="Serra do Café" location="Chapada de Minas · região aproximada" area="486 ha" use="Cafeicultura de altitude e relevo ondulado." image="cafe-montanha.jpg" tag="Cultivo perene"/>
      <FarmCard title="Águas Claras" location="Norte de Minas · região aproximada" area="790 ha" use="Pasto formado, água e benfeitorias rurais." image="pasto-nelore.jpg" tag="Pecuária"/>
      <FarmCard title="Campo das Veredas" location="Grão Mogol · região aproximada" area="640 ha" use="Perfil agrícola com estrutura de armazenagem." image="silos-armazem.jpg" tag="Vocação agrícola"/>
    </div><p className="ga-disclaimer">Catálogo e imagens demonstrativos, sem anúncios reais.</p></div></section>
    <Footer />

    {gallery && <div className="ga-lightbox" role="dialog" aria-modal="true" aria-label="Galeria de imagens ilustrativas" onTouchStart={e=>{(e.currentTarget as HTMLDivElement).dataset.touchX=String(e.touches[0].clientX);}} onTouchEnd={e=>{const x=Number((e.currentTarget as HTMLDivElement).dataset.touchX);const delta=e.changedTouches[0].clientX-x;if(Math.abs(delta)>45)delta<0?next():prev();}}>
      <div className="ga-lightbox-top"><span>{photos[photo].caption} · {photo+1} / {photos.length}</span><span>Imagens ilustrativas</span></div>
      <img src={`${IMG}${photos[photo].src}`} alt={photos[photo].caption}/>
      <button type="button" className="ga-lightbox-close" aria-label="Fechar galeria" onClick={()=>setGallery(false)}>×</button>
      <div className="ga-lightbox-controls"><button type="button" aria-label="Foto anterior" onClick={prev}><ChevronLeft/></button><button type="button" aria-label="Próxima foto" onClick={next}><ChevronRight/></button></div>
    </div>}
    {video && <div className="ga-video-dialog" role="dialog" aria-modal="true" aria-labelledby="ga-video-title" onClick={e=>{if(e.target===e.currentTarget)setVideo(false);}}>
      <div className="ga-video-card"><button className="ga-lightbox-close" type="button" aria-label="Fechar aviso" onClick={()=>setVideo(false)}>×</button><span className="ga-seal-icon"><CirclePlay/></span><h3 id="ga-video-title">Prévia demonstrativa</h3><p>Não foi fornecido vídeo real ou link de YouTube para esta propriedade. Esta área não reproduz conteúdo externo.</p><button className="ga-btn ga-btn--green" type="button" onClick={()=>setVideo(false)}>Fechar <ArrowUpRight/></button></div>
    </div>}
  </main>;
}

function MapPinIcon() {
  return <MapPin />;
}
