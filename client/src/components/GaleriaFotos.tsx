import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

export function GaleriaFotos({fotos,titulo}: {fotos:Array<{url:string;legenda:string|null}>;titulo:string}) {
  const [indice,setIndice]=useState<number|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const touch=useRef(0);
  useEffect(()=>{
    if(indice===null)return;
    const el=dialog.current!;
    el.showModal();
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{el.close();document.body.style.overflow=overflow;};
  },[indice===null]);
  if(!fotos.length)return <p className="ga-disclaimer">Fotografias em atualização.</p>;
  const mover=(d:number)=>setIndice(i=>i===null?null:(i+d+fotos.length)%fotos.length);
  return <>
    <div className={`ga-gallery ${fotos.length===1?"ga-gallery-single":""}`} aria-label="Fotografias da propriedade">
      {fotos.slice(0,3).map((p,i)=><button type="button" key={p.url} className={i===0?"ga-gallery-main":""} onClick={()=>setIndice(i)} aria-label={`Ampliar foto ${i+1}: ${p.legenda || titulo}`}>
        <img src={p.url} alt={p.legenda || `${titulo} — foto ${i+1}`}/><span className="ga-photo-caption">{p.legenda || titulo}</span>{i===0&&<span className="ga-gallery-open"><Maximize2/></span>}
      </button>)}
    </div><button className="ga-icon-button ga-all-photos" type="button" onClick={()=>setIndice(0)}><Maximize2/>Ver todas as {fotos.length} fotos</button>
    {indice!==null && <dialog ref={dialog} className="ga-lightbox ga-dialog" aria-label="Galeria de fotos" onCancel={()=>setIndice(null)} onClose={()=>setIndice(null)} onKeyDown={e=>{if(e.key==="ArrowRight"){e.preventDefault();mover(1);}if(e.key==="ArrowLeft"){e.preventDefault();mover(-1);}}}
      onTouchStart={e=>{touch.current=e.touches[0].clientX;}} onTouchEnd={e=>{const d=e.changedTouches[0].clientX-touch.current;if(Math.abs(d)>45)mover(d<0?1:-1);}}>
      <div className="ga-lightbox-top" aria-live="polite"><span>{fotos[indice].legenda || titulo} · {indice+1} / {fotos.length}</span></div>
      <img src={fotos[indice].url} alt={fotos[indice].legenda || `${titulo} — foto ${indice+1}`}/>
      <button className="ga-lightbox-close" type="button" aria-label="Fechar galeria" onClick={()=>setIndice(null)} autoFocus><X/></button>
      {fotos.length>1&&<div className="ga-lightbox-controls"><button type="button" aria-label="Foto anterior" onClick={()=>mover(-1)}><ChevronLeft/></button><button type="button" aria-label="Próxima foto" onClick={()=>mover(1)}><ChevronRight/></button></div>}
    </dialog>}
  </>;
}
