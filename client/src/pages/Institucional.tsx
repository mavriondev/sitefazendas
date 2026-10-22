import { useEffect, useState } from "react";
import { api, linkWhatsapp } from "../api";
import { useSite } from "../contexto";
import { FormContato } from "../components/FormContato";
import { Secoes, useConteudo, LinkConteudo, fundoConteudo } from "../components/Conteudo";

export function TopoConteudo({ pagina, titulo }: { pagina: string; titulo?: string }) {
  const { texto:t } = useConteudo(pagina);
  const cabecalho = titulo ?? t("topo.titulo");
  useEffect(() => { document.title = cabecalho; }, [cabecalho]);
  return <section className="topo-pagina cms-topo" data-cms-secao="topo" style={fundoConteudo(t("topo.imagem"))}>
    <div className="container"><span className="rotulo-sec">{t("topo.rotulo")}</span><h1>{cabecalho}</h1>{t("topo.texto")&&<p className="cms-rich-text">{t("topo.texto")}</p>}</div>
  </section>;
}

export function Sobre() {
  const { config } = useSite();
  const { texto:t } = useConteudo("sobre");
  const zap = linkWhatsapp(config?.whatsapp_padrao, "Olá! Gostaria de conversar sobre fazendas.");
  return <div className="cms-institutional-grid"><Secoes pagina="sobre" blocos={{
    topo:<TopoConteudo pagina="sobre" titulo={config?.sobre_titulo || "Sobre nós"}/>,
    apresentacao:<div className="cms-body cms-reading" data-cms-secao="apresentacao">
      {(config?.sobre_texto ?? "").split(/\n{2,}/).filter(Boolean).map((texto,n)=><p key={n} className="texto-longo">{texto}</p>)}
    </div>,
    principios:<div className="cms-body cms-reading" data-cms-secao="principios"><div className="passos">
      {[1,2,3].map(n=><div className="passo" key={n}><div className="n">0{n}</div><h3>{t(`principios.titulo${n}`)}</h3><p className="cms-rich-text">{t(`principios.texto${n}`)}</p></div>)}
    </div></div>,
    acoes:<div className="cms-body cms-reading linha" data-cms-secao="acoes">
      <LinkConteudo className="btn" href={t("acoes.link_catalogo")}>{t("acoes.catalogo")}</LinkConteudo>
      <LinkConteudo className="btn sec" href={t("acoes.link_venda")}>{t("acoes.venda")}</LinkConteudo>
      {zap&&<a className="btn sec" href={zap} target="_blank" rel="noopener noreferrer">{t("acoes.whatsapp")}</a>}
    </div>,
  }}/></div>;
}

export function Parceiros() {
  const { texto:t } = useConteudo("parceiros");
  const [lista,setLista]=useState<Array<{id:number;nome:string;logo:string|null;url:string|null}>|null>(null);
  useEffect(()=>{void api.get("/api/public/parceiros").then(r=>setLista(r.parceiros)).catch(()=>setLista([]));},[]);
  return <div className="cms-institutional-grid"><Secoes pagina="parceiros" blocos={{
    topo:<TopoConteudo pagina="parceiros"/>,
    lista:<div className="cms-body" data-cms-secao="lista">
      {lista===null?<p role="status">Carregando…</p>:!lista.length?<div className="vazio"><h3>{t("lista.vazio_titulo")}</h3><p>{t("lista.vazio_texto")}</p></div>:
        <div className="parceiros-grade">{lista.map(p=>{
          const corpo=<><div className="logo">{p.logo?<img src={p.logo} alt={p.nome} loading="lazy"/>:<span>{p.nome}</span>}</div><div className="nome-parceiro">{p.nome}</div></>;
          return p.url?<a key={p.id} className="parceiro" href={p.url} target="_blank" rel="noopener noreferrer">{corpo}</a>:<div className="parceiro" key={p.id}>{corpo}</div>;
        })}</div>}
    </div>,
  }}/></div>;
}

export function Contato() {
  const { config }=useSite();
  const { texto:t }=useConteudo("contato");
  const zap=linkWhatsapp(config?.whatsapp_padrao,"Olá! Vim pelo site e gostaria de falar com o corretor.");
  return <div className="cms-institutional-grid"><Secoes pagina="contato" blocos={{
    topo:<TopoConteudo pagina="contato"/>,
    formulario:<div className="cms-form" data-cms-secao="formulario"><FormContato tipo="contato"/></div>,
    atendimento:<aside className="cms-sidebar lateral" data-cms-secao="atendimento"><div className="painel">
      <h3>{t("atendimento.titulo")}</h3>
      {zap&&<p><a className="btn" href={zap} target="_blank" rel="noopener noreferrer">{t("atendimento.whatsapp")}</a></p>}
      {config?.contato_email&&<p><strong>{t("atendimento.email")}</strong><br/><a href={`mailto:${config.contato_email}`}>{config.contato_email}</a></p>}
      {config?.contato_endereco&&<p><strong>{t("atendimento.endereco")}</strong><br/>{config.contato_endereco}</p>}
      {config?.contato_horario&&<p><strong>{t("atendimento.horario")}</strong><br/>{config.contato_horario}</p>}
      {config?.texto_creci&&<p className="suave pequeno">{config.texto_creci}</p>}
    </div></aside>,
  }}/></div>;
}

export function VendaSuaFazenda() {
  const { texto:t }=useConteudo("venda");
  return <div className="cms-institutional-grid"><Secoes pagina="venda" blocos={{
    topo:<TopoConteudo pagina="venda"/>,
    formulario:<div className="cms-form" data-cms-secao="formulario"><FormContato tipo="anuncio"/></div>,
    etapas:<aside className="cms-sidebar lateral" data-cms-secao="etapas"><div className="painel">
      <h3>{t("etapas.titulo")}</h3><ol style={{paddingLeft:18}}>{[1,2,3,4].map(n=><li key={n} className="cms-rich-text">{t(`etapas.texto${n}`)}</li>)}</ol>
    </div></aside>,
  }}/></div>;
}
