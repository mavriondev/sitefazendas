import { ChartNoAxesCombined, CloudRain, Droplets, FileCheck2, House, Info, LandPlot, Landmark, Layers, Mountain, Route, ShieldCheck, Sprout, TrainFront, Trees, Zap } from "lucide-react";
import type { AtributoPublico } from "../api";
import { useConteudo } from "./Conteudo";
export const ICONES: Record<string,typeof Mountain> = {
  altitude_media:Mountain,argila_media:Layers,declividade_media:ChartNoAxesCombined,precipitacao_anual:CloudRain,
  area_aproveitavel_ha:LandPlot,agua:Droplets,energia:Zap,uso_solo:Sprout,logistica_rodovia:Route,logistica_ferrovia:TrainFront,benfeitorias:House,documentacao:FileCheck2,
  sobrep_terra_indigena:Landmark,sobrep_unidade_conservacao:Trees
};
const dataBr=(iso?:string)=>{const m=iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:null;};

function Grade({itens}:{itens:AtributoPublico[]}){
  return <div className="ga-data-grid">{itens.map(a=>{const Icon=ICONES[a.chave] || Info;const dt=dataBr(a.atualizado_em);
    return <article className="ga-data-item" key={a.chave}><span className="ga-data-icon"><Icon aria-hidden="true"/></span><span className="ga-data-label">{a.rotulo}</span><strong>{a.texto}</strong>
      {a.origem === "oficial" && <span className="ga-status indicado"><ShieldCheck aria-hidden="true"/><span>Fonte: {a.fonte}{dt?` · atualizado em ${dt}`:""}</span></span>}
    </article>;})}</div>;
}

export function Caracteristicas({atributos}: {atributos:AtributoPublico[]}) {
  const {texto:t}=useConteudo("fazenda");
  if(!atributos.length)return null;
  return <section className="ga-data-panel"><h3>{t("imovel.caracteristicas")}</h3>
    <Grade itens={atributos}/>
     <p className="ga-data-legend">Informações indicativas, sujeitas à verificação documental e em campo. As fontes e datas de registros anteriores são preservadas, sem atualização automática.</p>
  </section>;
}
