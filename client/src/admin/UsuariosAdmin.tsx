import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Erro, Ok } from "../components/Avisos";
import { AvisoLimite, useAcaoUnica, useConfirmar } from "./comuns";

export default function UsuariosAdmin() {
  const [l, setL] = useState<any[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const carregar = useCallback(() => api.get("/api/admin/usuarios").then((r) => { setL(r.usuarios); setTotal(r.total); }).catch(setErro), []);
  useEffect(() => { void carregar(); }, [carregar]);
  const [total, setTotal] = useState<number | undefined>();
  const [ok, setOk] = useState("");
  const [confirmar, dialogo] = useConfirmar();
  const [executar, ocupado] = useAcaoUnica(async (fn: () => Promise<unknown>, m: string = "Salvo.") => {
    setErro(null); setOk(""); try { await fn(); setOk(m); await carregar(); } catch (x) { setErro(x); }
  });
  const mudar = (id: number, corpo: object) => executar(() => api.put(`/api/admin/usuarios/${id}`, corpo), "Alteração salva.");
  const [link, setLink] = useState("");
  const gerarLink = (u: any) => executar(async () => { const r = await api.post(`/api/admin/usuarios/${u.id}/link-senha`); setLink(`${window.location.origin}${r.caminho}`); }, `Link gerado para ${u.nome}.`);
  const excluir = async (u: any) => {
    if (!(await confirmar({ titulo: `Excluir ${u.nome}?`, texto: "Os dados da conta serão apagados e os contatos feitos por ela, anonimizados. Isso não pode ser desfeito.", confirmar: "Excluir conta", perigo: true }))) return;
    void executar(() => api.del(`/api/admin/usuarios/${u.id}`), "Conta excluída.");
  };
  return (
    <div aria-busy={ocupado}>
      <h1>Usuários</h1>
      {link && <div className="msg ok">Envie este link ao usuário (vale 1 hora, uso único):<br /><input readOnly value={link} onFocus={(e) => e.target.select()} /></div>}
      <p className="suave">O nível define o detalhe que o usuário vê na pesquisa de terras: aberto (faixas amplas), desbloqueado (faixas finas) e completo (valores exatos, nunca a localização).</p>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <AvisoLimite total={total} mostrados={l.length} />
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
      {dialogo}
    </div>
  );
}
