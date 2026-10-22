import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import Fazendas from "./pages/Fazendas";
import FazendaDetalhe from "./pages/FazendaDetalhe";
import { Contato, Parceiros, Sobre, VendaSuaFazenda } from "./pages/Institucional";
import Pesquisa from "./pages/Pesquisa";
import Privacidade from "./pages/Privacidade";
import { Cadastro, Entrar, MinhaConta, RedefinirSenha } from "./pages/Conta";
import AdminLayout from "./admin/AdminLayout";
import FazendasAdmin from "./admin/FazendasAdmin";
import FazendaEditor from "./admin/FazendaEditor";
import ParceirosAdmin from "./admin/ParceirosAdmin";
import SlidesAdmin from "./admin/SlidesAdmin";
import ConfigAdmin from "./admin/ConfigAdmin";
import UsuariosAdmin from "./admin/UsuariosAdmin";
import ContatosAdmin from "./admin/ContatosAdmin";
import ConteudoAdmin from "./admin/ConteudoAdmin";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="fazendas" element={<Fazendas />} />
        <Route path="fazenda/:slug" element={<FazendaDetalhe />} />
        <Route path="sobre" element={<Sobre />} />
        <Route path="parceiros" element={<Parceiros />} />
        <Route path="contato" element={<Contato />} />
        <Route path="venda-sua-fazenda" element={<VendaSuaFazenda />} />
        <Route path="pesquisa" element={<Pesquisa />} />
        <Route path="entrar" element={<Entrar />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="conta" element={<MinhaConta />} />
        <Route path="redefinir-senha" element={<RedefinirSenha />} />
        <Route path="privacidade" element={<Privacidade />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<FazendasAdmin />} />
          <Route path="fazendas/:id" element={<FazendaEditor />} />
          <Route path="contatos" element={<ContatosAdmin />} />
          <Route path="slides" element={<SlidesAdmin />} />
          <Route path="parceiros" element={<ParceirosAdmin />} />
          <Route path="usuarios" element={<UsuariosAdmin />} />
          <Route path="config" element={<ConfigAdmin />} />
          <Route path="conteudo" element={<ConteudoAdmin />} />
        </Route>
        <Route path="*" element={<div className="container pagina"><h1>Página não encontrada</h1></div>} />
      </Route>
    </Routes>
  );
}
