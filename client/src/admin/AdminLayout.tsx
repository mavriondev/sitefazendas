import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useSite } from "../contexto";

export default function AdminLayout() {
  const { usuario, carregando } = useSite();
  if (carregando) return null;
  if (!usuario || usuario.papel !== "admin") return <Navigate to="/entrar?de=/admin" replace />;
  return (
    <div className="container pagina admin-layout">
      <nav className="admin-menu" aria-label="Painel">
        <NavLink to="/admin" end>Fazendas</NavLink>
        <NavLink to="/admin/contatos">Contatos</NavLink>
        <NavLink to="/admin/conteudo">Conteúdo do site</NavLink>
        <NavLink to="/admin/seo">SEO e buscadores</NavLink>
        <NavLink to="/admin/slides">Slides da home</NavLink>
        <NavLink to="/admin/parceiros">Parceiros</NavLink>
        <NavLink to="/admin/usuarios">Usuários</NavLink>
        <NavLink to="/admin/config">Configurações</NavLink>
      </nav>
      <section><Outlet /></section>
    </div>
  );
}
