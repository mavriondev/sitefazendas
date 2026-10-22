import type { ReactNode } from "react";
import { Leaf, MapPin, Wheat } from "lucide-react";
import { Link } from "react-router-dom";
import { useConteudo, fundoConteudo } from "./Conteudo";

export const IMAGENS = "/images/gramogol/";
export function Eyebrow({children}: {children: ReactNode}) {
  return <span className="ga-kicker"><Leaf size={16} aria-hidden="true"/>{children}</span>;
}
export function Botanical() {
  return <div className="ga-botanical" aria-hidden="true"><svg viewBox="0 0 460 240" fill="none">
    <path d="M30 240C75 184 104 142 142 80M122 240c28-65 44-115 46-180M236 240c-7-52-1-106 22-169M344 240c-8-58 2-115 34-169" stroke="#c3df69" strokeWidth="2"/>
    <g fill="#c3df69">{[[81,174,-42],[104,142,44],[127,105,-35],[149,73,43],[154,189,-39],[168,150,43],[174,117,-43],[243,194,-42],[242,155,42],[248,120,-42],[266,82,43],[350,189,-43],[359,151,43],[367,115,-40],[382,80,43]].map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="10" ry="25" transform={`rotate(${r} ${x} ${y})`}/>)}</g>
  </svg></div>;
}
export function Seals() {
  const {texto:t}=useConteudo("home");
  return <div className="ga-hero-seals">{[
    {Icon:Wheat,text:t("hero.selo1")},
    {Icon:Leaf,text:t("hero.selo2")},
    {Icon:MapPin,text:t("hero.selo3")}
  ].map(({Icon,text},i)=><div className="ga-seal" key={i}><span className="ga-seal-icon"><Icon aria-hidden="true"/></span><span>{text}</span></div>)}</div>;
}
export function Banner({titulo}: {titulo: string}) {
  const {texto:t}=useConteudo("fazenda");
  return <section className="ga-page-banner cms-fundo" style={fundoConteudo(t("topo.imagem"))}><div className="ga-wrap"><h1 className="ga-title">{titulo}</h1><p className="ga-breadcrumb"><Link to="/">{t("topo.inicio")}</Link>　›　<Link to="/fazendas">{t("topo.catalogo")}</Link>　›　{titulo}</p></div></section>;
}
