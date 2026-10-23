import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Users, Globe, Handshake, Images, Search, Settings, Tractor, MessageSquare, Newspaper } from "lucide-react";
import { useSite } from "../contexto";
import "./admin.css";

export default function AdminLayout() {
  const { usuario, carregando } = useSite();
  const { pathname } = useLocation();
  const emFazendas = pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/admin/fazendas/");
  if (carregando) return null;
  if (!usuario || usuario.papel !== "admin") return <Navigate to="/entrar?de=/admin" replace />;
  return (
    <div className="container pagina admin-layout">
      <nav className="admin-menu" aria-label="Painel">
        <Link to="/admin" className={emFazendas ? "active" : undefined} aria-current={emFazendas ? "page" : undefined}><Tractor aria-hidden="true" /><span>Fazendas</span></Link>
        <NavLink to="/admin/contatos"><MessageSquare aria-hidden="true" /><span>Contatos</span></NavLink>
        <NavLink to="/admin/conteudo"><Globe aria-hidden="true" /><span>Conteúdo do site</span></NavLink>
        <NavLink to="/admin/agro"><Newspaper aria-hidden="true" /><span>Notícias e cotações</span></NavLink>
        <NavLink to="/admin/seo"><Search aria-hidden="true" /><span>SEO e buscadores</span></NavLink>
        <NavLink to="/admin/slides"><Images aria-hidden="true" /><span>Slides da home</span></NavLink>
        <NavLink to="/admin/parceiros"><Handshake aria-hidden="true" /><span>Parceiros</span></NavLink>
        <NavLink to="/admin/usuarios"><Users aria-hidden="true" /><span>Usuários</span></NavLink>
        <NavLink to="/admin/config"><Settings aria-hidden="true" /><span>Configurações</span></NavLink>
      </nav>
      <section><Outlet /></section>
    </div>
  );
}
