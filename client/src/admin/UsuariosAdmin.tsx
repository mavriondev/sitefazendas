import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Erro } from "../components/Avisos";

export default function UsuariosAdmin() {
  const [l, setL] = useState<any[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const carregar = useCallback(() => api.get("/api/admin/usuarios").then((r) => setL(r.usuarios)).catch(setErro), []);
  useEffect(() => { void carregar(); }, [carregar]);
  const mudar = async (id: number, corpo: object) => { setErro(null); try { await api.put(`/api/admin/usuarios/${id}`, corpo); await carregar(); } catch (x) { setErro(x); } };
  const [link, setLink] = useState("");
  const gerarLink = async (u: any) => {
    setErro(null);
    try { const r = await api.post(`/api/admin/usuarios/${u.id}/link-senha`); setLink(`${window.location.origin}${r.caminho}`); } catch (x) { setErro(x); }
  };
  const excluir = async (u: any) => {
    if (!confirm(`Excluir ${u.nome}? Os dados da conta serão apagados e os contatos feitos por ela, anonimizados.`)) return;
    setErro(null);
    try { await api.del(`/api/admin/usuarios/${u.id}`); await carregar(); } catch (x) { setErro(x); }
  };
  return (
    <>
      <h1>Usuários</h1>
      {link && <div className="msg ok">Envie este link ao usuário (vale 1 hora, uso único):<br /><input readOnly value={link} onFocus={(e) => e.target.select()} /></div>}
      <p className="suave">O nível define o detalhe que o usuário vê na pesquisa de terras: aberto (faixas amplas), desbloqueado (faixas finas) e completo (valores exatos, nunca a localização).</p>
      <Erro erro={erro} />
      <div className="tabela-rolagem" role="region" aria-label="Lista de usuários" tabIndex={0}>
      <table className="tabela tabela-responsiva">
        <thead><tr><th>Nome</th><th>Contato</th><th>Papel</th><th>Nível</th><th>Bloqueado</th><th>Ações</th></tr></thead>
        <tbody>{l.map((u) => (
          <tr key={u.id}>
            <td data-rotulo="Nome">{u.nome}</td><td data-rotulo="Contato">{u.email}<br />{u.whatsapp}</td><td data-rotulo="Papel">{u.papel}</td>
            <td data-rotulo="Nível"><select aria-label={`Nível de acesso de ${u.nome}`} value={u.nivel_acesso} onChange={(e) => mudar(u.id, { nivel_acesso: e.target.value })}><option value="aberto">Aberto</option><option value="desbloqueado">Desbloqueado</option><option value="completo">Completo</option></select></td>
            <td data-rotulo="Bloqueado"><input aria-label={`Bloquear ${u.nome}`} type="checkbox" style={{ width: "auto" }} checked={u.bloqueado} onChange={(e) => mudar(u.id, { bloqueado: e.target.checked })} /></td>
            <td data-rotulo="Ações">
              <button className="btn sec" onClick={() => gerarLink(u)}>Link de nova senha</button>{" "}
              <button className="btn sec" onClick={() => excluir(u)}>Excluir</button>
            </td>
          </tr>))}</tbody>
      </table></div>
    </>
  );
}
