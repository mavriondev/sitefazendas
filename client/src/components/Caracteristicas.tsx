import { BadgeCheck, ChartNoAxesCombined, CloudRain, Droplets, FileCheck2, House, Info, LandPlot, Layers, Mountain, Route, Sprout, TrainFront, Zap } from "lucide-react";
import type { AtributoPublico } from "../api";
const ICONES: Record<string,typeof Mountain> = {
  altitude_media:Mountain,argila_media:Layers,declividade_media:ChartNoAxesCombined,precipitacao_anual:CloudRain,
  area_aproveitavel_ha:LandPlot,agua:Droplets,energia:Zap,uso_solo:Sprout,logistica_rodovia:Route,logistica_ferrovia:TrainFront,benfeitorias:House,documentacao:FileCheck2
};
export function Caracteristicas({atributos}: {atributos:AtributoPublico[]}) {
  if(!atributos.length)return null;
  return <section className="ga-data-panel"><h3>Características da terra</h3><div className="ga-data-grid">
    {atributos.map(a=>{const Icon=ICONES[a.chave] || Info;return <article className="ga-data-item" key={a.chave}><span className="ga-data-icon"><Icon aria-hidden="true"/></span><span className="ga-data-label">{a.rotulo}</span><strong>{a.texto}</strong><span className={`ga-status ${a.confianca}`}>{a.confianca==="confirmado"?<BadgeCheck/>:<Info/>}{a.confianca==="confirmado"?"Confirmado pelo corretor":"Indicado por fonte pública"}</span></article>;})}
  </div><p className="ga-data-legend">“Confirmado” foi verificado pelo corretor com vendedor, documento ou visita. “Indicado por fonte pública” vem de bases e modelos; não equivale a medição em campo nem garante as condições atuais.</p></section>;
}
