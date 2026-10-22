import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Droplets, Leaf, MapPin, Ruler, Search, ShieldCheck, Wheat } from "lucide-react";
import { Botanical, ButtonLink, Eyebrow, FarmCard, FontLoad, Footer, Header, IMG, PAGE_FARM, Seals } from "./_shared/Shared";

const farms = [
  { title:"Horizonte do Cerrado", location:"Norte de Minas · região de Grão Mogol", area:"1.240 ha", use:"Lavoura, pecuária e estrutura para expansão.", image:"cerrado-soja-aerea.jpg", tag:"Seleção do corretor", activity:"Agricultura", size:"Grande" },
  { title:"Serra do Café", location:"Chapada de Minas · região aproximada", area:"486 ha", use:"Cafeicultura de altitude e relevo ondulado.", image:"cafe-montanha.jpg", tag:"Cultivo perene", activity:"Cafeicultura", size:"Média" },
  { title:"Águas Claras", location:"Norte de Minas · região aproximada", area:"790 ha", use:"Pasto formado, água e benfeitorias rurais.", image:"pasto-nelore.jpg", tag:"Pecuária", activity:"Pecuária", size:"Média" },
];

export function Inicio() {
  const [query,setQuery] = useState("");
  const [activity,setActivity] = useState("Todas as atividades");
  const [size,setSize] = useState("Qualquer área");
  const [searched,setSearched] = useState(false);
  const filtered = useMemo(()=>farms.filter(f=>
    (!query || `${f.title} ${f.location} ${f.area}`.toLowerCase().includes(query.toLowerCase())) &&
    (activity === "Todas as atividades" || f.activity === activity) &&
    (size === "Qualquer área" || f.size === size)
  ),[query,activity,size]);
  return <main className="gramogol-agrezen">
    <FontLoad />
    <section className="ga-hero" id="inicio">
      <img className="ga-hero-photo" src={`${IMG}cerrado-soja-aerea.jpg`} alt="" />
      <Header active="Início" />
      <div className="ga-wrap ga-hero-content">
        <div className="ga-hero-copy">
          <Eyebrow>Fazendas à venda · Gramogol</Eyebrow>
          <h1 className="ga-title">Terra boa.<br/>Negócios de confiança.</h1>
          <p>Propriedades rurais selecionadas e uma conversa direta com o corretor — com discrição desde o primeiro contato.</p>
          <div className="ga-hero-actions"><ButtonLink href="#fazendas">Explorar fazendas</ButtonLink><a className="ga-btn ga-btn--glass" href="#sobre">Conheça a Gramogol <ArrowUpRight /></a></div>
        </div>
        <Seals />
      </div>
      <Botanical /><span className="ga-hero-note">Imagem ilustrativa · catálogo demonstrativo</span>
    </section>

    <div className="ga-search-band" id="busca"><form className="ga-wrap ga-search" onSubmit={(e)=>{e.preventDefault();setSearched(true);document.getElementById("fazendas")?.scrollIntoView({behavior:"smooth"});}}>
      <div className="ga-search-field"><label htmlFor="ga-region">Região ou palavra-chave</label><input id="ga-region" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: Norte de Minas"/></div>
      <div className="ga-search-field"><label htmlFor="ga-activity">Atividade rural</label><select id="ga-activity" value={activity} onChange={e=>setActivity(e.target.value)}><option>Todas as atividades</option><option>Agricultura</option><option>Cafeicultura</option><option>Pecuária</option></select></div>
      <div className="ga-search-field"><label htmlFor="ga-area">Área aproximada</label><select id="ga-area" value={size} onChange={e=>setSize(e.target.value)}><option>Qualquer área</option><option>Média</option><option>Grande</option></select></div>
      <button className="ga-btn ga-btn--green" type="submit"><Search /> Buscar fazendas</button>
    </form></div>

    <section className="ga-section" id="fazendas"><div className="ga-wrap">
      <div className="ga-section-head"><div><Eyebrow>Portfólio rural</Eyebrow><h2 className="ga-section-title">Fazendas em destaque</h2></div><a className="ga-link-arrow" href={PAGE_FARM}>Ver catálogo <ArrowRight /></a></div>
      {searched && <p role="status" className="ga-disclaimer">{filtered.length} resultado(s) para os filtros escolhidos.</p>}
      <div className="ga-cards">{filtered.map(f=><FarmCard key={f.title} {...f}/>)}</div>
      {filtered.length === 0 && <div className="ga-data-panel" role="status"><h3>Nenhuma propriedade neste recorte</h3><p>Altere a região ou os filtros para consultar o catálogo ilustrativo.</p></div>}
      <p className="ga-disclaimer">Propriedades e dados apresentados são ilustrativos e não representam anúncios reais. Imagens geradas para demonstração. Localização aproximada; detalhes tratados diretamente com o corretor.</p>
    </div></section>

    <section className="ga-section ga-section--cream" id="sobre"><div className="ga-wrap ga-split">
      <div className="ga-split-art"><img className="ga-split-main" src={`${IMG}sede-fazenda.jpg`} alt="Sede rural ilustrativa"/><img className="ga-split-inset" src={`${IMG}represa.jpg`} alt="Represa em propriedade rural ilustrativa"/><span className="ga-seal-float"><Leaf /></span></div>
      <div className="ga-split-copy"><Eyebrow>Intermediação próxima</Eyebrow><h2 className="ga-section-title">Cada negociação começa com uma boa conversa.</h2><p>A Gramogol aproxima produtores e compradores de terras rurais com atendimento pessoal. As informações públicas são compartilhadas com responsabilidade, sem expor endereço exato, proprietário ou documentos sensíveis.</p>
        <div className="ga-benefits"><div className="ga-benefit"><span className="ga-seal-icon"><ShieldCheck /></span>Sigilo respeitado</div><div className="ga-benefit"><span className="ga-seal-icon"><Droplets /></span>Dados com origem</div><div className="ga-benefit"><span className="ga-seal-icon"><Wheat /></span>Vocação da terra</div><div className="ga-benefit"><span className="ga-seal-icon"><MapPin /></span>Região aproximada</div></div>
        <ButtonLink href={PAGE_FARM} green>Ver uma fazenda</ButtonLink>
      </div>
    </div></section>

    <section className="ga-step-band"><div className="ga-wrap"><div className="ga-section-head"><div><Eyebrow>Atendimento direto</Eyebrow><h2 className="ga-section-title">Compra séria começa com conversa direta.</h2></div></div>
      <div className="ga-steps"><article className="ga-step"><span className="ga-step-no">01</span><h3>Navegue com discrição</h3><p>Consulte as propriedades e as informações liberadas para o público, sem expor sua identidade.</p></article><article className="ga-step"><span className="ga-step-no">02</span><h3>Peça os detalhes</h3><p>Uma propriedade chamou sua atenção? Converse sobre os dados complementares em atendimento direto.</p></article><article className="ga-step"><span className="ga-step-no">03</span><h3>Conheça com segurança</h3><p>O corretor acompanha a conversa, a visita e os próximos passos da negociação.</p></article></div>
    </div></section>

    <section className="ga-section" id="venda"><div className="ga-wrap ga-split">
      <div className="ga-split-copy"><Eyebrow>Venda sua fazenda</Eyebrow><h2 className="ga-section-title">A propriedade certa merece a conversa certa.</h2><p>Quer apresentar uma fazenda ao mercado? Fale diretamente com a equipe para entender como funciona a intermediação e quais informações podem ser divulgadas.</p><ButtonLink href="#contato">Conversar sobre venda <ArrowUpRight /></ButtonLink></div>
      <div className="ga-split-art"><img className="ga-split-main" src={`${IMG}silos-armazem.jpg`} alt="Estrutura rural ilustrativa"/><img className="ga-split-inset" src={`${IMG}lavoura-milho.jpg`} alt="Lavoura ilustrativa"/><span className="ga-seal-float"><Wheat /></span></div>
    </div></section>

    <section className="ga-section ga-section--cream ga-partners" id="parceiros"><div className="ga-wrap"><Eyebrow>Rede de parceiros</Eyebrow><h2 className="ga-section-title">Conhecimento que soma à negociação.</h2><p>Espaço reservado à apresentação dos parceiros cadastrados pela Gramogol. Nenhuma marca ou parceria real foi incluída nesta prévia demonstrativa.</p><a className="ga-link-arrow" href="#contato">Conversar com a Gramogol <ArrowRight/></a></div></section>
    <section className="ga-dark-cta"><div className="ga-wrap"><div><Eyebrow>Gramogol Fazendas</Eyebrow><h2 className="ga-section-title">Terra, propósito e uma negociação bem conduzida.</h2><p>Fale com o corretor sobre compra ou venda rural. O contato é pessoal e o destino de WhatsApp será configurado antes da publicação.</p></div><a href="#contato" className="ga-btn">Falar com a equipe <ArrowUpRight /></a></div></section>
    <Footer />
  </main>;
}
