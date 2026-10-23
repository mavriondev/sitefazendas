import { useState } from "react";
import { BadgeCheck, ChartNoAxesCombined, CloudRain, Droplets, FileCheck2, House, Info, LandPlot, Landmark, Layers, Mountain, Route, ShieldCheck, Sprout, TrainFront, Trees, Zap } from "lucide-react";
import type { AtributoPublico } from "../api";
import { useConteudo } from "./Conteudo";
export const ICONES: Record<string,typeof Mountain> = {
  altitude_media:Mountain,argila_media:Layers,declividade_media:ChartNoAxesCombined,precipitacao_anual:CloudRain,
  area_aproveitavel_ha:LandPlot,agua:Droplets,energia:Zap,uso_solo:Sprout,logistica_rodovia:Route,logistica_ferrovia:TrainFront,benfeitorias:House,documentacao:FileCheck2,
  sobrep_terra_indigena:Landmark,sobrep_unidade_conservacao:Trees
};
const dataBr=(iso?:string)=>{const m=iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:null;};

function Grade({itens,oficial}:{itens:AtributoPublico[];oficial:boolean}){
  return <div className="ga-data-grid">{itens.map(a=>{const Icon=ICONES[a.chave] || Info;const dt=dataBr(a.atualizado_em);
    return <article className="ga-data-item" key={a.chave}><span className="ga-data-icon"><Icon aria-hidden="true"/></span><span className="ga-data-label">{a.rotulo}</span><strong>{a.texto}</strong>
      {oficial
        ? <span className="ga-status indicado"><ShieldCheck aria-hidden="true"/><span>{a.confianca==="confirmado"?"Confirmado pelo corretor · ":""}Fonte: {a.fonte}{dt?` · atualizado em ${dt}`:""}</span></span>
        : <span className={`ga-status ${a.confianca}`}>{a.confianca==="confirmado"?<BadgeCheck aria-hidden="true"/>:<Info aria-hidden="true"/>}<span>{a.confianca==="confirmado"?"Confirmado pelo corretor":"Informado pelo corretor"}</span></span>}
    </article>;})}</div>;
}

export function Caracteristicas({atributos}: {atributos:AtributoPublico[]}) {
  const {texto:t}=useConteudo("fazenda");
  const [aba,setAba]=useState<"corretor"|"oficial">("corretor");
  if(!atributos.length)return null;
  const corretor=atributos.filter(a=>a.origem!=="oficial"), oficial=atributos.filter(a=>a.origem==="oficial");
  const atual=corretor.length&&oficial.length?aba:corretor.length?"corretor":"oficial";
  const ultima=oficial.map(a=>a.atualizado_em||"").sort().pop();
  const fontes=[...new Set(oficial.map(a=>a.fonte).filter(Boolean))].join(", ");
  return <section className="ga-data-panel"><h3>{t("imovel.caracteristicas")}</h3>
    {corretor.length>0&&oficial.length>0&&<div className="ga-data-tabs" role="tablist" aria-label="Tipo de informação">
      {([["corretor","Informações do imóvel"],["oficial","Dados do governo sobre o ativo"]] as const).map(([k,rot])=><button key={k} type="button" role="tab" id={`ga-aba-${k}`} aria-selected={atual===k} aria-controls="ga-aba-painel" tabIndex={atual===k?0:-1} className={atual===k?"ativo":""} onClick={()=>setAba(k)}>{rot}</button>)}
    </div>}
    <div id="ga-aba-painel" role={corretor.length&&oficial.length?"tabpanel":undefined} aria-labelledby={corretor.length&&oficial.length?`ga-aba-${atual}`:undefined}>
      {atual==="corretor"
        ? <><Grade itens={corretor} oficial={false}/><p className="ga-data-legend">“Confirmado” foi verificado pelo corretor com vendedor, documento ou visita. Os demais itens foram informados pelo corretor e podem mudar.</p></>
        : <><Grade itens={oficial} oficial/><p className="ga-data-legend">Dados obtidos de bases públicas do governo ({fontes}){dataBr(ultima)?`; última atualização em ${dataBr(ultima)}`:""}. São indicativas, não substituem documentos nem medição em campo e podem estar defasadas.</p></>}
    </div>
  </section>;
}
