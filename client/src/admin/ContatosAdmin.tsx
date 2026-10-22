import { useCallback, useEffect, useState } from "react";
import { api, linkWhatsapp } from "../api";
import { Erro } from "../components/Avisos";

export default function ContatosAdmin() {
  const [l, setL] = useState<any[]>([]);
  const [ap, setAp] = useState<any[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [nova, setNova] = useState({ comprador_nome: "", comprador_contato: "", fazenda_id: "", pesquisa_token: "", canal: "whatsapp", observacao: "" });
  const carregar = useCallback(async () => {
    try { const [c, a] = await Promise.all([api.get("/api/admin/contatos"), api.get("/api/admin/apresentacoes")]); setL(c.contatos); setAp(a.apresentacoes); } catch (x) { setErro(x); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  const status = async (id: number, s: string) => { try { await api.put(`/api/admin/contatos/${id}`, { status: s }); await carregar(); } catch (x) { setErro(x); } };
  const registrar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    try {
      await api.post("/api/admin/apresentacoes", { ...nova, fazenda_id: nova.fazenda_id ? Number(nova.fazenda_id) : undefined, pesquisa_token: nova.pesquisa_token || undefined });
      setNova({ ...nova, comprador_nome: "", comprador_contato: "", fazenda_id: "", pesquisa_token: "", observacao: "" }); await carregar();
    } catch (x) { setErro(x); }
  };
  return (
    <>
      <h1>Contatos</h1>
      <Erro erro={erro} />
      <div className="tabela-rolagem" role="region" aria-label="Lista de contatos" tabIndex={0}>
      <table className="tabela tabela-responsiva">
        <thead><tr><th>Quando</th><th>Quem</th><th>Origem / interesse</th><th>Mensagem</th><th>Ações</th></tr></thead>
        <tbody>{l.map((c) => {
          const wa = linkWhatsapp(c.whatsapp, `Olá ${c.nome}, aqui é sobre seu interesse${c.fazenda_titulo ? ` na fazenda ${c.fazenda_titulo}` : ""}.`);
          return (
            <tr key={c.id}>
              <td data-rotulo="Quando">{new Date(c.criado_em).toLocaleString("pt-BR")}</td>
              <td data-rotulo="Quem">{c.nome}<br />{wa ? <a href={wa} target="_blank" rel="noopener noreferrer">{c.whatsapp}</a> : c.whatsapp}{c.email && <><br />{c.email}</>}</td>
              <td data-rotulo="Origem / interesse"><span className="etiqueta">{({ vitrine: "Fazenda", pesquisa: "Pesquisa", contato: "Contato", anuncio: "Quer vender" } as Record<string, string>)[c.origem] ?? c.origem}</span><br />{c.fazenda_titulo ?? (c.pesquisa_cod_imovel ? `(${c.pesquisa_uf}) CAR ${c.pesquisa_cod_imovel}` : "")}</td>
              <td data-rotulo="Mensagem" style={{ whiteSpace: "pre-line" }}>{c.mensagem}</td>
              <td data-rotulo="Ações"><button className="btn sec" onClick={() => status(c.id, c.status === "novo" ? "atendido" : "novo")}>{c.status === "novo" ? "Marcar atendido" : "Reabrir"}</button></td>
            </tr>);
        })}{l.length === 0 && <tr><td colSpan={5} className="suave">Nenhum contato ainda.</td></tr>}</tbody>
      </table></div>
      <h2>Registro de apresentações</h2>
      <p className="suave">Anote a quem e quando você apresentou cada terra (prova de intermediação).</p>
      <form className="painel filtros" onSubmit={registrar}>
        <div><label>Comprador</label><input required value={nova.comprador_nome} onChange={(e) => setNova({ ...nova, comprador_nome: e.target.value })} /></div>
        <div><label>Contato</label><input value={nova.comprador_contato} onChange={(e) => setNova({ ...nova, comprador_contato: e.target.value })} /></div>
        <div><label>ID da fazenda</label><input inputMode="numeric" value={nova.fazenda_id} onChange={(e) => setNova({ ...nova, fazenda_id: e.target.value })} /></div>
        <div><label>ou código da pesquisa</label><input value={nova.pesquisa_token} onChange={(e) => setNova({ ...nova, pesquisa_token: e.target.value })} /></div>
        <div><label>Canal</label><select value={nova.canal} onChange={(e) => setNova({ ...nova, canal: e.target.value })}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="presencial">Presencial</option></select></div>
        <div><label>Observação</label><input value={nova.observacao} onChange={(e) => setNova({ ...nova, observacao: e.target.value })} /></div>
        <button className="btn" type="submit">Registrar</button>
      </form>
      <div className="tabela-rolagem" role="region" aria-label="Registro de apresentações" tabIndex={0}>
      <table className="tabela tabela-responsiva"><thead><tr><th>Data</th><th>Comprador</th><th>Imóvel</th><th>Canal</th></tr></thead>
        <tbody>{ap.map((a) => <tr key={a.id}><td data-rotulo="Data">{new Date(a.apresentado_em).toLocaleString("pt-BR")}</td><td data-rotulo="Comprador">{a.comprador_nome}</td><td data-rotulo="Imóvel">{a.fazenda_titulo ?? a.pesquisa_token}</td><td data-rotulo="Canal">{a.canal}</td></tr>)}</tbody></table></div>
    </>
  );
}
