import { useState } from "react";
import { api } from "../api";
import type { useConfirmar } from "./comuns";

interface Video {id:number;youtube_id:string;titulo:string;ordem:number;publico:boolean}
type Confirmar = ReturnType<typeof useConfirmar>[0];
type Acao = (fn:()=>Promise<unknown>,msg?:string)=>Promise<void>;
export function VideosAdmin({id,videos,acao,confirmar}: {id:string;videos:Video[];acao:Acao;confirmar:Confirmar}) {
  return <section className="painel"><h3>Vídeos do YouTube</h3>
    <p className="suave">Os vídeos são incorporados na página da fazenda. Aceita links watch, youtu.be, Shorts e transmissões. Menor ordem aparece primeiro.</p>
    <div className="msg aviso">Antes de autorizar a exibição pública, revise imagens, áudio, descrição e canal do vídeo no YouTube. Não publique conteúdo que revele o CAR, endereço exato ou dados do proprietário. O vídeo pode identificar o canal de origem.</div>
    <Editor key="novo" id={id} acao={acao} confirmar={confirmar}/>
    {videos.map(v=><Editor key={`${v.id}-${v.youtube_id}-${v.titulo}-${v.ordem}-${v.publico}`} id={id} video={v} acao={acao} confirmar={confirmar}/>)}
    {!videos.length&&<p>Nenhum vídeo cadastrado para esta fazenda.</p>}
  </section>;
}
function Editor({id,video,acao,confirmar}: {id:string;video?:Video;acao:Acao;confirmar:Confirmar}) {
  const [titulo,setTitulo]=useState(video?.titulo || "");
  const [url,setUrl]=useState(video?`https://www.youtube.com/watch?v=${video.youtube_id}`:"");
  const [ordem,setOrdem]=useState(String(video?.ordem ?? 0));
  const [publico,setPublico]=useState(video?.publico || false);
  const [busy,setBusy]=useState(false);
  const salvar=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);
    let salvo=false;
    try {await acao(async()=>{
      const corpo={titulo,url,ordem:Number(ordem),publico};
      if(video)await api.put(`/api/admin/videos/${video.id}`,corpo);
      else await api.post(`/api/admin/fazendas/${id}/videos`,corpo);
      salvo=true;
    },video?"Vídeo atualizado.":"Vídeo cadastrado.");
    if(salvo&&!video){setTitulo("");setUrl("");setOrdem("0");setPublico(false);}
    }finally{setBusy(false);}
  };
  return <form className="ga-video-editor" onSubmit={e=>void salvar(e)}>
    <h4>{video?"Editar vídeo":"Adicionar vídeo"}</h4>
    <label>Título público<input required maxLength={120} value={titulo} onChange={e=>setTitulo(e.target.value)}/></label>
    <label>Link do YouTube<input required type="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={e=>setUrl(e.target.value)}/></label>
    <label>Ordem<input required type="number" min={-100000} max={100000} step={1} value={ordem} onChange={e=>setOrdem(e.target.value)}/></label>
    <label className="linha"><input type="checkbox" checked={publico} onChange={e=>setPublico(e.target.checked)}/>Revisei o conteúdo e autorizo exibir este vídeo no anúncio público</label>
    <div className="linha"><button className="btn" disabled={busy} type="submit">{busy?"Salvando…":video?"Salvar vídeo":"Adicionar vídeo"}</button>{video&&<>
      <a className="btn sec" href={`https://www.youtube.com/watch?v=${video.youtube_id}`} target="_blank" rel="noopener noreferrer">Revisar no YouTube</a>
      <button className="btn perigo" disabled={busy} type="button" onClick={async()=>{if(await confirmar({titulo:"Remover este vídeo da fazenda?",texto:"O vídeo não será apagado do YouTube.",confirmar:"Remover vídeo",perigo:true}))void acao(()=>api.del(`/api/admin/videos/${video.id}`),"Vídeo removido.");}}>Remover vídeo</button>
    </>}</div>
  </form>;
}
