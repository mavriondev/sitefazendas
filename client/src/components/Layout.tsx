import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle } from "lucide-react";
import { useSite } from "../contexto";
import { linkWhatsapp } from "../api";
import { IMAGENS } from "./Agrezen";
import { AccountDropdown } from "./AccountDropdown";
import "../agrezen.css";
import "../agrezen-integration.css";

export function Layout() {
  const {config, usuario} = useSite();
  const {pathname} = useLocation();
  useEffect(()=>{window.scrollTo(0,0);},[pathname]);
  const nome = config?.nome_site || "Gramogol Fazendas";
  const zap = linkWhatsapp(config?.whatsapp_padrao,"Olá! Vim pelo site e gostaria de conversar sobre fazendas.");
  const home = pathname === "/";
  const detail = pathname.startsWith("/fazenda/");
  return <div className={`gramogol-agrezen site-public ${home?"is-home":""} ${detail?"is-detail":""}`}>
    <a className="pular-conteudo" href="#conteudo">Pular para o conteúdo</a>
    <header className="ga-head"><div className="ga-wrap ga-head-inner">
      <Link to="/" aria-label={`${nome} — Início`}><img className="ga-logo" src={IMAGENS+"logo-gramogol-claro.png"} alt={nome}/></Link>
      <nav className="ga-nav" aria-label="Principal">
        <NavLink to="/" end>Início</NavLink><NavLink to="/sobre">Sobre</NavLink>
        <NavLink to="/parceiros">Parceiros</NavLink><NavLink to="/venda-sua-fazenda">Venda sua fazenda</NavLink><NavLink to="/contato">Contato</NavLink>
        {config?.modulo_pesquisa_ativo && <NavLink to="/pesquisa">Pesquisa de terras</NavLink>}
        {usuario?.papel === "admin" && <NavLink to="/admin">Painel</NavLink>}
      </nav>
      <div className="ga-head-actions">
        <Link className="ga-btn ga-head-cta" to="/fazendas">Ver fazendas <ArrowUpRight aria-hidden="true"/></Link>
        <AccountDropdown />
      </div>
    </div></header>
    <main id="conteudo"><Outlet/></main>
    {zap && <a className="ga-floating-whatsapp" href={zap} target="_blank" rel="noopener noreferrer" aria-label="Falar com o corretor no WhatsApp"><MessageCircle aria-hidden="true"/></a>}
    <footer className="ga-footer" id="contato-rodape"><div className="ga-wrap">
      <div className="ga-footer-grid">
        <div><Link to="/"><img className="ga-footer-logo" src={IMAGENS+"logo-gramogol-claro.png"} alt={nome}/></Link><p>{config?.aviso_intermediacao || "Intermediação rural com atendimento pessoal e respeito à confidencialidade de cada negociação."}</p>{config?.texto_creci && <p>{config.texto_creci}</p>}</div>
        <div><h3>Explore</h3><div className="ga-footer-links"><Link to="/">Início</Link><Link to="/fazendas">Fazendas disponíveis</Link><Link to="/sobre">Sobre a Gramogol</Link><Link to="/parceiros">Parceiros</Link><Link to="/venda-sua-fazenda">Venda sua fazenda</Link>{config?.modulo_pesquisa_ativo && <Link to="/pesquisa">Pesquisa de terras</Link>}<Link to="/privacidade">Política de privacidade</Link></div></div>
        <div><h3>Conversa direta</h3>{zap && <a className="ga-footer-contact" href={zap} target="_blank" rel="noopener noreferrer"><MessageCircle/>Falar no WhatsApp</a>}
          {config?.contato_email && <a className="ga-footer-contact" href={`mailto:${config.contato_email}`}><Mail/>{config.contato_email}</a>}
          {config?.contato_endereco && <div className="ga-footer-contact"><MapPin/>{config.contato_endereco}</div>}
          {config?.contato_horario && <div className="ga-footer-contact"><Clock/>{config.contato_horario}</div>}
          <div className="ga-footer-links"><Link to="/contato">Contato</Link>{config?.instagram_url && <a href={config.instagram_url} target="_blank" rel="noopener noreferrer">Instagram</a>}<Link to={usuario?"/conta":"/entrar"}>{usuario?"Minha conta":"Entrar"}</Link></div>
        </div>
      </div><div className="ga-footer-bottom">© {new Date().getFullYear()} {nome} · Intermediação de imóveis rurais</div>
    </div></footer>
  </div>;
}
