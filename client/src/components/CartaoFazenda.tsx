import { Link } from "react-router-dom";
import { ArrowUpRight, Banknote, MapPin, Ruler, Image } from "lucide-react";
import type { FazendaPublica } from "../api";

export function CartaoFazenda({f}: {f: FazendaPublica}) {
  return <Link to={`/fazenda/${f.slug}`} className="ga-farm-card">
    <div className="ga-farm-image">{f.capa ? <img src={f.capa} alt={f.titulo} loading="lazy"/> : <div className="ga-image-empty"><Image/><span>Fotografias em atualização</span></div>}
      {f.destaque && <span className="ga-farm-tag">Seleção do corretor</span>}
    </div>
    <div className="ga-farm-body"><span className="ga-region"><MapPin aria-hidden="true"/>{f.regiao}</span><h3 className="ga-card-title">{f.titulo}</h3>
      <p>{f.culturas.length ? f.culturas.join(" · ") : "Propriedade rural"}</p>
      <div className="ga-farm-specs"><span><Ruler aria-hidden="true"/>{f.area || "Área sob consulta"}</span><span><Banknote aria-hidden="true"/>{f.preco || "Sob consulta"}</span><span className="ga-card-arrow" aria-label="Ver detalhes"><ArrowUpRight/></span></div>
    </div>
  </Link>;
}
