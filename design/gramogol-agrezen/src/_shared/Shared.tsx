import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Leaf, MapPin, Menu, MoveRight, Ruler, Wheat, X } from "lucide-react";
import "./agrezen.css";

export const IMG = "/__mockup/images/gramogol/";
export const PAGE_HOME = "/__mockup/preview/gramogol-agrezen/Inicio";
export const PAGE_FARM = "/__mockup/preview/gramogol-agrezen/Fazenda";

export function FontLoad() {
  return <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Nunito+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </>;
}

export function Header({ active = "Início" }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const homeTarget = (anchor: string) => active === "Início" ? anchor : `${PAGE_HOME}${anchor}`;
  const links = [
    ["Início", PAGE_HOME], ["Fazendas", PAGE_FARM], ["Sobre", homeTarget("#sobre")],
    ["Parceiros", homeTarget("#parceiros")], ["Venda sua fazenda", homeTarget("#venda")], ["Contato", homeTarget("#contato")], ["Entrar", homeTarget("#contato")],
  ];
  return <header className="ga-head"><div className="ga-wrap ga-head-inner">
    <a href={PAGE_HOME} aria-label="Gramogol Fazendas — início"><img className="ga-logo" src={`${IMG}logo-gramogol-claro.png`} alt="Gramogol Fazendas" /></a>
    <nav className={`ga-nav ${open ? "ga-nav-open" : ""}`} aria-label="Navegação principal">
      {links.map(([label, href]) => <a key={label} href={href} onClick={() => setOpen(false)} aria-current={label === active ? "page" : undefined}>{label}</a>)}
    </nav>
    <a className="ga-btn ga-head-cta" href={homeTarget("#contato")}>Fale com o corretor <ArrowUpRight /></a>
    <button className="ga-menu" type="button" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
  </div></header>;
}

export function Botanical() {
  return <div className="ga-botanical" aria-hidden="true"><svg viewBox="0 0 460 240" fill="none">
    <path d="M30 240C75 184 104 142 142 80M122 240c28-65 44-115 46-180M236 240c-7-52-1-106 22-169M344 240c-8-58 2-115 34-169" stroke="#c3df69" strokeWidth="2"/>
    <g fill="#c3df69">{[[81,174,-42],[104,142,44],[127,105,-35],[149,73,43],[154,189,-39],[168,150,43],[174,117,-43],[243,194,-42],[242,155,42],[248,120,-42],[266,82,43],[350,189,-43],[359,151,43],[367,115,-40],[382,80,43]].map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="10" ry="25" transform={`rotate(${r} ${x} ${y})`} />)}</g>
  </svg></div>;
}

export function Seals() {
  return <div className="ga-hero-seals">
    <div className="ga-seal"><span className="ga-seal-icon"><Wheat /></span><span>Terra produtiva<br/>e bem cuidada</span></div>
    <div className="ga-seal"><span className="ga-seal-icon"><Leaf /></span><span>Negociação<br/>com discrição</span></div>
    <div className="ga-seal"><span className="ga-seal-icon"><MapPin /></span><span>Atendimento<br/>próximo e direto</span></div>
  </div>;
}

export function Footer() {
  return <footer className="ga-footer" id="contato"><div className="ga-wrap">
    <div className="ga-footer-grid">
      <div><img className="ga-footer-logo" src={`${IMG}logo-gramogol-claro.png`} alt="Gramogol Fazendas" /><p>Intermediação rural com atendimento pessoal e respeito à confidencialidade de cada negociação.</p></div>
      <div><h3>Explore</h3><div className="ga-footer-links"><a href={PAGE_HOME}>Início</a><a href={PAGE_FARM}>Fazendas disponíveis</a><a href={PAGE_HOME+"#venda"}>Venda sua fazenda</a><a href={PAGE_HOME+"#sobre"}>Como trabalhamos</a></div></div>
      <div><h3>Conversa direta</h3><div className="ga-footer-contact"><MapPin />Atendimento rural — Brasil</div><div className="ga-footer-contact"><Leaf />WhatsApp do corretor: destino ainda não configurado</div></div>
    </div>
    <div className="ga-footer-bottom">© Gramogol Fazendas · Catálogo demonstrativo · CRECI não informado neste protótipo</div>
  </div></footer>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="ga-kicker"><Leaf size={16} />{children}</span>;
}

export function ButtonLink({ href, children, green = false }: { href: string; children: ReactNode; green?: boolean }) {
  return <a className={`ga-btn${green ? " ga-btn--green" : ""}`} href={href}>{children}<ArrowUpRight /></a>;
}

export function FarmCard({ title, location, area, use, image, tag }: { title:string;location:string;area:string;use:string;image:string;tag:string }) {
  return <a className="ga-farm-card" href={PAGE_FARM}>
    <div className="ga-farm-image"><img src={`${IMG}${image}`} alt="Imagem ilustrativa de paisagem rural" loading="lazy"/><span className="ga-farm-tag">{tag}</span></div>
    <div className="ga-farm-body"><span className="ga-region"><MapPin />{location}</span><h3 className="ga-card-title">{title}</h3><p>{use}</p>
      <div className="ga-farm-specs"><span><Ruler />{area}</span><span><Wheat />Uso rural</span><span><MoveRight />Consulte</span></div>
    </div>
  </a>;
}

export function WhatsAppUnavailable({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return <>
    <button type="button" className="ga-btn ga-btn--green" onClick={() => setOpen(true)} aria-haspopup="dialog">WhatsApp: {title} <ArrowUpRight /></button>
    <p className="ga-whatsapp-note">Destino de WhatsApp ainda não configurado nesta prévia. Nenhuma mensagem será enviada.</p>
    {open && <div className="ga-video-dialog" role="dialog" aria-modal="true" aria-labelledby="ga-wa-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="ga-video-card"><button className="ga-lightbox-close" type="button" aria-label="Fechar aviso" onClick={() => setOpen(false)}><span>×</span></button>
        <span className="ga-seal-icon"><Leaf /></span><h3 id="ga-wa-title">Contato direto com o corretor</h3>
        <p>O destino de WhatsApp do corretor ainda não está configurado nesta prévia. O imóvel selecionado é <strong>{title}</strong>. Não há número fictício nem mensagem enviada.</p>
        <button className="ga-btn ga-btn--green" type="button" onClick={() => setOpen(false)}>Entendi <ArrowUpRight /></button>
      </div>
    </div>}
  </>;
}
