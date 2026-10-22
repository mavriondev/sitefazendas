import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSite } from "../contexto";

export function Layout() {
  const { config, usuario, sair } = useSite();
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); setAberto(false); }, [pathname]);
  useEffect(() => {
    if (!aberto) return;
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [aberto]);
  const nome = config?.nome_site ?? "Fazendas";
  return (
    <>
      <header className="topo">
        <div className="container">
          <Link to="/" className="marca"><i aria-hidden="true" />{nome}</Link>
          <button type="button" className="menu-btn" aria-expanded={aberto} aria-controls="menu-principal" onClick={() => setAberto((a) => !a)}>{aberto ? "Fechar" : "Menu"}</button>
          <nav id="menu-principal" aria-label="Principal" className={aberto ? "aberto" : ""} onClick={(e) => { if ((e.target as Element).closest("a")) setAberto(false); }}>
            <NavLink to="/fazendas">Fazendas</NavLink>
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
              {config?.modulo_pesquisa_ativo && <Link to="/pesquisa">Pesquisa de terras</Link>}
            </div>
            <div>
              <h4>Conta e legal</h4>
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
