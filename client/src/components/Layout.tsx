import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle } from "lucide-react";
import { useSite } from "../contexto";
import { linkWhatsapp } from "../api";
import { useConteudo, LinkConteudo, Secoes, fundoConteudo } from "./Conteudo";
import { AccountDropdown } from "./AccountDropdown";
import { SeoPagina } from "./SeoPagina";
import { WhatsappFlutuante } from "./WhatsappFlutuante";
import "../agrezen.css";
import "../agrezen-integration.css";
import "../conteudo-publico.css";

export function Layout() {
  const {config, usuario} = useSite();
  const {pathname} = useLocation();
  const {texto:t,ordem,visivel}=useConteudo("global");
  const homeConteudo=useConteudo("home");
  const fazendaConteudo=useConteudo("fazenda");
  useEffect(()=>{window.scrollTo(0,0);},[pathname]);
  const nome = config?.nome_site || "Gramogol Fazendas";
  const zap = linkWhatsapp(config?.whatsapp_padrao,t("marca.mensagem_whatsapp"));
  const home = pathname === "/" && homeConteudo.ordem[0] === "hero";
  const detail = pathname.startsWith("/fazenda/") && fazendaConteudo.ordem[0] === "topo";
  const menu=ordem.filter(id=>id.startsWith("menu_"));
  return <div className={`gramogol-agrezen site-public ${home?"is-home":""} ${detail?"is-detail":""}`}>
    <SeoPagina/>
    <a className="pular-conteudo" href="#conteudo">Pular para o conteúdo</a>
    <header className="ga-head"><div className="ga-wrap ga-head-inner">
      <div>{visivel("marca")&&<Link to="/" aria-label={`${nome} — Início`}>{t("marca.logo")?<img className="ga-logo" src={t("marca.logo")} alt={nome}/>:nome}</Link>}</div>
      <nav className="ga-nav" aria-label="Principal">
        {menu.map(id=>t(`${id}.link`).startsWith("/")?<NavLink key={id} to={t(`${id}.link`)} end={t(`${id}.link`)==="/"}>{t(`${id}.texto`)}</NavLink>:<LinkConteudo key={id} href={t(`${id}.link`)}>{t(`${id}.texto`)}</LinkConteudo>)}
        {config?.modulo_pesquisa_ativo && <NavLink to="/pesquisa">Pesquisa de terras</NavLink>}
        {usuario?.papel === "admin" && <NavLink to="/admin">Painel</NavLink>}
      </nav>
      <div className="ga-head-actions">
        {visivel("marca")&&<LinkConteudo className="ga-btn ga-head-cta" href={t("marca.destino")}>{t("marca.botao")} <ArrowUpRight aria-hidden="true"/></LinkConteudo>}
        <AccountDropdown />
      </div>
    </div></header>
    <main id="conteudo"><Outlet/></main>
    {!pathname.startsWith("/fazenda/") && <WhatsappFlutuante href={zap} rotulo={t("marca.whatsapp") || "Falar no WhatsApp"}/>}
    <footer className="ga-footer cms-fundo" style={fundoConteudo(t("marca.fundo_rodape"))} id="contato-rodape"><div className="ga-wrap">
      <div className="ga-footer-grid">
        <Secoes pagina="global" blocos={{
        rodape_marca:<div><Link to="/">{t("marca.logo_rodape")?<img className="ga-footer-logo" src={t("marca.logo_rodape")} alt={nome}/>:nome}</Link><p>{config?.aviso_intermediacao || "Intermediação rural com atendimento pessoal e respeito à confidencialidade de cada negociação."}</p>{config?.texto_creci && <p>{config.texto_creci}</p>}</div>,
        rodape_links:<div><h3>{t("rodape_links.titulo")}</h3><div className="ga-footer-links">{menu.map(id=><LinkConteudo key={id} href={t(`${id}.link`)}>{t(`${id}.texto`)}</LinkConteudo>)}<Link to="/fazendas">{t("rodape_links.catalogo")}</Link>{config?.modulo_pesquisa_ativo && <Link to="/pesquisa">Pesquisa de terras</Link>}<Link to="/privacidade">{t("rodape_links.privacidade")}</Link></div></div>,
        rodape_contatos:<div><h3>{t("rodape_contatos.titulo")}</h3>{zap && <a className="ga-footer-contact" href={zap} target="_blank" rel="noopener noreferrer"><MessageCircle/>{t("marca.whatsapp")}</a>}
          {config?.contato_email && <a className="ga-footer-contact" href={`mailto:${config.contato_email}`}><Mail/>{config.contato_email}</a>}
          {config?.contato_endereco && <div className="ga-footer-contact"><MapPin/>{config.contato_endereco}</div>}
          {config?.contato_horario && <div className="ga-footer-contact"><Clock/>{config.contato_horario}</div>}
          <div className="ga-footer-links"><Link to="/contato">Contato</Link>{config?.instagram_url && <a href={config.instagram_url} target="_blank" rel="noopener noreferrer">Instagram</a>}<Link to={usuario?"/conta":"/entrar"}>{usuario?"Minha conta":"Entrar"}</Link></div>
        </div>,
        }}/>
      </div>{visivel("rodape_creditos")&&<div className="ga-footer-bottom">© {new Date().getFullYear()} {nome} · {t("rodape_creditos.texto")}</div>}
    </div></footer>
  </div>;
}
