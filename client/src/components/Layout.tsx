import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useSite } from "../contexto";
import { linkWhatsapp } from "../api";

export function Layout() {
  const { config, usuario, sair } = useSite();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const nome = config?.nome_site ?? "Fazendas";
  const zap = linkWhatsapp(config?.whatsapp_padrao, "Olá! Vim pelo site e gostaria de conversar sobre fazendas.");
  return (
    <>
      <header className="topo">
        <div className="container">
          <Link to="/" className="marca"><i aria-hidden="true" />{nome}</Link>
          {/* Menu sempre visível: nenhum clique para abrir. No celular, os links quebram em linhas. */}
          <nav aria-label="Principal">
            <NavLink to="/" end>Início</NavLink>
            <NavLink to="/fazendas">Fazendas</NavLink>
            <NavLink to="/sobre">Sobre</NavLink>
            <NavLink to="/parceiros">Parceiros</NavLink>
            <NavLink to="/venda-sua-fazenda">Venda sua fazenda</NavLink>
            <NavLink to="/contato">Contato</NavLink>
            {config?.modulo_pesquisa_ativo && <NavLink to="/pesquisa">Pesquisa de terras</NavLink>}
            {usuario?.papel === "admin" && <NavLink to="/admin">Painel</NavLink>}
            {usuario ? (
              <>
                <NavLink to="/conta">{usuario.nome.split(" ")[0]}</NavLink>
                <a href="#sair" onClick={(e) => { e.preventDefault(); void sair(); }}>Sair</a>
              </>
            ) : (
              <>
                <NavLink to="/entrar">Entrar</NavLink>
                <NavLink to="/cadastro" className="cta">Cadastrar</NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
      {zap && <a className="zap-flutuante" href={zap} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp">WhatsApp</a>}
      <footer className="rodape">
        <div className="container">
          <div className="rodape-grade">
            <div>
              <p className="nome">{nome}</p>
              {config?.aviso_intermediacao && <p style={{ margin: "0 0 8px" }}>{config.aviso_intermediacao}</p>}
              {config?.texto_creci && <p style={{ margin: 0 }}>{config.texto_creci}</p>}
            </div>
            <div>
              <h4>Navegar</h4>
              <Link to="/">Início</Link>
              <Link to="/fazendas">Fazendas</Link>
              <Link to="/sobre">Sobre</Link>
              <Link to="/parceiros">Parceiros</Link>
              <Link to="/venda-sua-fazenda">Venda sua fazenda</Link>
              {config?.modulo_pesquisa_ativo && <Link to="/pesquisa">Pesquisa de terras</Link>}
            </div>
            <div>
              <h4>Contato</h4>
              <Link to="/contato">Fale conosco</Link>
              {config?.contato_email && <a href={`mailto:${config.contato_email}`}>{config.contato_email}</a>}
              {config?.instagram_url && <a href={config.instagram_url} target="_blank" rel="noopener noreferrer">Instagram</a>}
              <h4 style={{ marginTop: 18 }}>Conta e legal</h4>
              {!usuario && <Link to="/entrar">Entrar</Link>}
              {!usuario && <Link to="/cadastro">Cadastrar</Link>}
              {usuario && <Link to="/conta">Minha conta</Link>}
              <Link to="/privacidade">Política de privacidade</Link>
            </div>
          </div>
          <div className="fim">© {new Date().getFullYear()} {nome}</div>
        </div>
      </footer>
    </>
  );
}
