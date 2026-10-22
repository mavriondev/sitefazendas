import { useState } from "react";
import { CirclePlay, X } from "lucide-react";
import type { FazendaPublica } from "../api";

export function GaleriaVideos({videos}: {videos:FazendaPublica["videos"]}) {
  const [ativo,setAtivo]=useState<number|null>(null);
  if(!videos.length)return null;
  return <section className="ga-video" aria-labelledby="titulo-videos"><h3 id="titulo-videos">Galeria de vídeos</h3>
    <p className="ga-disclaimer">Ao reproduzir, você carrega conteúdo externo do YouTube. Nenhum player é carregado antes do seu clique.</p>
    <div className="ga-video-list">{videos.map(v=><article key={v.id} className="ga-video-item">
      {ativo===v.id?<><iframe src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?autoplay=1&rel=0`} title={v.titulo} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/><button className="ga-icon-button" type="button" onClick={()=>setAtivo(null)}><X/>Fechar vídeo</button></>:
      <button type="button" className="ga-video-thumb" onClick={()=>setAtivo(v.id)} aria-label={`Reproduzir: ${v.titulo}`}><img src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`} alt="" loading="lazy"/><span className="ga-play"><CirclePlay/></span><span>{v.titulo}</span></button>}
      <h4>{v.titulo}</h4>
    </article>)}</div>
  </section>;
}
