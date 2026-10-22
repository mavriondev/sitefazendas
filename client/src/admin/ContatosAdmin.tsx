import { useCallback, useEffect, useMemo, useState } from "react";
import { api, linkWhatsapp } from "../api";
import { Erro, Ok } from "../components/Avisos";
import { AvisoLimite, Campo, useAcaoUnica } from "./comuns";

const ORIGEM: Record<string, string> = { vitrine: "Fazenda", pesquisa: "Pesquisa", contato: "Contato", anuncio: "Quer vender" };
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const VAZIA = { comprador_nome: "", comprador_contato: "", fazenda_texto: "", pesquisa_token: "", canal: "whatsapp", observacao: "" };

export default function ContatosAdmin() {
  const [l, setL] = useState<any[]>([]);
  const [ap, setAp] = useState<any[]>([]);
  const [totais, setTotais] = useState<{ contatos?: number; apresentacoes?: number }>({});
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const [filtro, setFiltro] = useState<"novo" | "atendido" | "">("novo");
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState(VAZIA);
  const carregar = useCallback(async () => {
    try {
      const [c, a, f] = await Promise.all([api.get("/api/admin/contatos"), api.get("/api/admin/apresentacoes"), api.get("/api/admin/fazendas")]);
      setL(c.contatos); setAp(a.apresentacoes); setFazendas(f.fazendas); setTotais({ contatos: c.total, apresentacoes: a.total });
    } catch (x) { setErro(x); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const [executar, ocupado] = useAcaoUnica(async (fn: () => Promise<unknown>, m: string = "Salvo.") => {
    setErro(null); setOk(""); try { await fn(); setOk(m); await carregar(); } catch (x) { setErro(x); }
  });

  // O campo aceita o título (escolhido na lista) ou o número do ID, como antes.
  const fazendaEscolhida = useMemo(() => {
    const t = nova.fazenda_texto.trim();
    if (!t) return null;
    const porRotulo = fazendas.find((f) => `${f.titulo} (#${f.id})` === t);
    if (porRotulo) return porRotulo;
    return /^\d+$/.test(t) ? fazendas.find((f) => f.id === Number(t)) ?? { id: Number(t), titulo: `ID ${t}` } : undefined;
  }, [nova.fazenda_texto, fazendas]);

  const registrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (nova.fazenda_texto.trim() && !fazendaEscolhida) { setErro(new Error("Escolha uma fazenda da lista (ou digite o número do ID).")); return; }
    void executar(async () => {
      await api.post("/api/admin/apresentacoes", { comprador_nome: nova.comprador_nome, comprador_contato: nova.comprador_contato, canal: nova.canal, observacao: nova.observacao,
        fazenda_id: fazendaEscolhida?.id, pesquisa_token: nova.pesquisa_token || undefined });
      setNova({ ...VAZIA, canal: nova.canal });
    }, "Apresentação registrada.");
  };

  const novos = l.filter((c) => c.status === "novo").length;
  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim());
    return l.filter((c) => (!filtro || c.status === filtro) && (!q || semAcento([c.nome, c.email, c.whatsapp, c.mensagem, c.fazenda_titulo].filter(Boolean).join(" ")).includes(q)));
  }, [l, filtro, busca]);

  return (
    <div aria-busy={ocupado}>
      <h1>Contatos</h1>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <div className="barra-lista" role="search" aria-label="Filtrar contatos">
        <Campo rotulo="Buscar"><input type="search" placeholder="Nome, telefone, e-mail ou mensagem" value={busca} onChange={(e) => setBusca(e.target.value)} /></Campo>
        <Campo rotulo="Situação"><select value={filtro} onChange={(e) => setFiltro(e.target.value as any)}>
          <option value="novo">Novos ({novos})</option><option value="atendido">Atendidos ({l.length - novos})</option><option value="">Todos ({l.length})</option>
        </select></Campo>
      </div>
      <AvisoLimite total={totais.contatos} mostrados={l.length} />
      <p className="suave pequeno resumo-lista" role="status">{visiveis.length} contato(s) na lista</p>
      <div className="tabela-rolagem" role="region" aria-label="Lista de contatos" tabIndex={0}>
        <table className="tabela tabela-responsiva">
          <thead><tr><th>Quando</th><th>Quem</th><th>Origem / interesse</th><th>Mensagem</th><th>Ações</th></tr></thead>
          <tbody>{visiveis.map((c) => {
            const wa = linkWhatsapp(c.whatsapp, `Olá ${c.nome}, aqui é sobre seu interesse${c.fazenda_titulo ? ` na fazenda ${c.fazenda_titulo}` : ""}.`);
            return (
              <tr key={c.id}>
                <td data-rotulo="Quando">{new Date(c.criado_em).toLocaleString("pt-BR")}</td>
                <td data-rotulo="Quem">{c.nome}<br />{wa ? <a href={wa} target="_blank" rel="noopener noreferrer">{c.whatsapp}</a> : c.whatsapp}{c.email && <><br />{c.email}</>}</td>
                <td data-rotulo="Origem / interesse"><span className="etiqueta">{ORIGEM[c.origem] ?? c.origem}</span><br />{c.fazenda_titulo ?? (c.pesquisa_cod_imovel ? `(${c.pesquisa_uf}) CAR ${c.pesquisa_cod_imovel}` : "")}</td>
                <td data-rotulo="Mensagem" style={{ whiteSpace: "pre-line" }}>{c.mensagem}</td>
                <td data-rotulo="Ações"><button className="btn sec" onClick={() => void executar(() => api.put(`/api/admin/contatos/${c.id}`, { status: c.status === "novo" ? "atendido" : "novo" }), c.status === "novo" ? "Contato marcado como atendido." : "Contato reaberto.")}>{c.status === "novo" ? "Marcar atendido" : "Reabrir"}</button></td>
              </tr>);
          })}{visiveis.length === 0 && <tr><td colSpan={5} className="suave">{l.length === 0 ? "Nenhum contato ainda." : "Nenhum contato com esses filtros."}</td></tr>}</tbody>
        </table>
      </div>

      <h2>Registro de apresentações</h2>
      <p className="suave">Anote a quem e quando você apresentou cada terra (prova de intermediação).</p>
      <form className="painel filtros" onSubmit={registrar}>
        <Campo rotulo="Comprador"><input required value={nova.comprador_nome} onChange={(e) => setNova({ ...nova, comprador_nome: e.target.value })} /></Campo>
        <Campo rotulo="Contato"><input value={nova.comprador_contato} onChange={(e) => setNova({ ...nova, comprador_contato: e.target.value })} /></Campo>
        <Campo rotulo="Fazenda" dica="Digite para buscar pelo título.">
          <input list="lista-fazendas" value={nova.fazenda_texto} onChange={(e) => setNova({ ...nova, fazenda_texto: e.target.value })} autoComplete="off" />
        </Campo>
        <datalist id="lista-fazendas">{fazendas.map((f) => <option key={f.id} value={`${f.titulo} (#${f.id})`} />)}</datalist>
        <Campo rotulo="ou código da pesquisa"><input value={nova.pesquisa_token} onChange={(e) => setNova({ ...nova, pesquisa_token: e.target.value })} /></Campo>
        <Campo rotulo="Canal"><select value={nova.canal} onChange={(e) => setNova({ ...nova, canal: e.target.value })}>
          <option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="presencial">Presencial</option>
        </select></Campo>
        <Campo rotulo="Observação"><input value={nova.observacao} onChange={(e) => setNova({ ...nova, observacao: e.target.value })} /></Campo>
        <button className="btn" type="submit" disabled={ocupado}>Registrar</button>
      </form>
      <AvisoLimite total={totais.apresentacoes} mostrados={ap.length} />
      <div className="tabela-rolagem" role="region" aria-label="Registro de apresentações" tabIndex={0}>
        <table className="tabela tabela-responsiva"><thead><tr><th>Data</th><th>Comprador</th><th>Imóvel</th><th>Canal</th></tr></thead>
          <tbody>{ap.map((a) => <tr key={a.id}><td data-rotulo="Data">{new Date(a.apresentado_em).toLocaleString("pt-BR")}</td><td data-rotulo="Comprador">{a.comprador_nome}</td><td data-rotulo="Imóvel">{a.fazenda_titulo ?? a.pesquisa_token}</td><td data-rotulo="Canal">{a.canal}</td></tr>)}
            {ap.length === 0 && <tr><td colSpan={4} className="suave">Nenhuma apresentação registrada.</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
