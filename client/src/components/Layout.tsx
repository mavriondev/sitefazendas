import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useSite } from "../contexto";

export function Layout() {
  const { config, usuario, sair } = useSite();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const nome = config?.nome_site ?? "Fazendas";
  return (
    <>
      <header className="topo">
        <div className="container">
          <Link to="/" className="marca">{nome}</Link>
          <nav>
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
                <NavLink to="/cadastro">Cadastrar</NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="rodape">
        <div className="container">
          <p style={{ margin: "0 0 6px" }}>{config?.aviso_intermediacao}</p>
          {config?.texto_creci && <p style={{ margin: "0 0 6px" }}>{config.texto_creci}</p>}
          <p style={{ margin: 0 }}><Link to="/privacidade">Política de privacidade</Link></p>
        </div>
      </footer>
    </>
  );
}
