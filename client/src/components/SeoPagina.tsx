import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { useSite } from "../contexto";
import type { MetaSeo } from "../../../shared/seo";

/** O HTML inicial vem pronto do servidor; também sincroniza navegações da SPA. */
export function SeoPagina() {
  const {pathname}=useLocation();
  const {conteudo}=useSite();
  useEffect(()=>{
    let ativo=true,sequencia=0;
    const atualizar=async()=>{
      const atual=++sequencia;
      try {
        const m=await api.get<MetaSeo>(`/api/public/seo?caminho=${encodeURIComponent(pathname)}`);
        if(!ativo||atual!==sequencia) return;
        document.title=m.titulo;
        const meta=(chave:string,valor:string,prop=false)=>{
          const atributo=prop?"property":"name";
          let el=document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${chave}"]`);
          if(!valor){el?.remove();return;}
          if(!el){el=document.createElement("meta");el.setAttribute(atributo,chave);document.head.appendChild(el);}
          el.content=valor;
        };
        meta("description",m.descricao);meta("robots",m.indexar?"index, follow":"noindex, nofollow");
        meta("og:type","website",true);meta("og:locale","pt_BR",true);meta("og:site_name",m.nome_site,true);
        for(const [k,v] of Object.entries({title:m.titulo,description:m.descricao,image:m.imagem,url:m.canonical})) meta(`og:${k}`,v,true);
        meta("twitter:card",m.imagem?"summary_large_image":"summary");
        for(const [k,v] of Object.entries({title:m.titulo,description:m.descricao,image:m.imagem})) meta(`twitter:${k}`,v);
        meta("google-site-verification",m.google);meta("msvalidate.01",m.bing);
        let canonical=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if(!m.canonical) canonical?.remove();
        else {if(!canonical){canonical=document.createElement("link");canonical.rel="canonical";document.head.appendChild(canonical);}canonical.href=m.canonical;}
        document.head.querySelectorAll('script[type="application/ld+json"]').forEach(el=>el.remove());
        if(m.canonical){
          const script=document.createElement("script");script.type="application/ld+json";
          script.textContent=JSON.stringify({"@context":"https://schema.org","@type":"WebPage",name:m.titulo,description:m.descricao,url:m.canonical});
          document.head.appendChild(script);
        }
      } catch {
        if(ativo&&atual===sequencia) {
          document.title="Gramogol Fazendas";
          document.head.querySelector('link[rel="canonical"]')?.remove();
          const robots=document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
          if(robots) robots.content="noindex, nofollow";
        }
      }
    };
    void atualizar();
    const focus=()=>{if(document.visibilityState==="visible")void atualizar();};
    window.addEventListener("focus",focus);
    const timer=window.setInterval(focus,60000);
    return()=>{ativo=false;window.removeEventListener("focus",focus);window.clearInterval(timer);};
  },[pathname,conteudo.revisao]);
  return null;
}
