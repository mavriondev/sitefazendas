import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Erro, Ok } from "../components/Avisos";
import { Campo, useAcaoUnica, useConfirmar } from "./comuns";

const ROTULO: Record<string, string> = { rascunho: "Rascunho", publicada: "Publicada", vendida: "Vendida", arquivada: "Arquivada" };
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function FazendasAdmin() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [ordem, setOrdem] = useState("recentes");
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const [confirmar, dialogo] = useConfirmar();
  const nav = useNavigate();
  useEffect(() => { void api.get("/api/admin/fazendas").then((r) => setLista(r.fazendas)).catch((x) => { setErro(x); setLista([]); }); }, []);

  const [criar, criando] = useAcaoUnica(async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    try { const r = await api.post("/api/admin/fazendas", { titulo }); nav(`/admin/fazendas/${r.id}`); } catch (x) { setErro(x); }
  });
  const [excluir, excluindo] = useAcaoUnica(async (f: any) => {
    if (!(await confirmar({ titulo: `Excluir "${f.titulo}"?`, texto: "A fazenda, as fotos, os vídeos e os dados da terra serão apagados definitivamente. Isso não pode ser desfeito.", confirmar: "Excluir definitivamente", perigo: true }))) return;
    setErro(null); setOk("");
    try { await api.del(`/api/admin/fazendas/${f.id}`); setLista((l) => (l ?? []).filter((x) => x.id !== f.id)); setOk("Fazenda excluída."); } catch (x) { setErro(x); }
  });

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of lista ?? []) c[f.status] = (c[f.status] ?? 0) + 1;
    return c;
  }, [lista]);
  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim());
    const l = (lista ?? []).filter((f) => (!status || f.status === status)
      && (!q || semAcento([f.titulo, f.municipio, f.uf, f.regiao_publica, f.car_codigo].filter(Boolean).join(" ")).includes(q)));
    const cmp: Record<string, (a: any, b: any) => number> = {
      recentes: (a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)),
      titulo: (a, b) => String(a.titulo).localeCompare(String(b.titulo), "pt-BR"),
      status: (a, b) => String(a.status).localeCompare(String(b.status)) || String(a.titulo).localeCompare(String(b.titulo), "pt-BR"),
    };
    return [...l].sort(cmp[ordem] ?? cmp.recentes);
  }, [lista, busca, status, ordem]);

  return (
    <>
    <div aria-busy={criando || excluindo} className={criando || excluindo ? "travado" : ""}>
      <h1>Fazendas</h1>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <form className="painel linha" onSubmit={criar}>
        <input required aria-label="Título da nova fazenda" placeholder="Título da nova fazenda" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <button className="btn" type="submit" disabled={criando}>Cadastrar</button>
      </form>
      <div className="barra-lista" role="search" aria-label="Buscar fazendas">
        <Campo rotulo="Buscar"><input type="search" placeholder="Título, município, região ou CAR" value={busca} onChange={(e) => setBusca(e.target.value)} /></Campo>
        <Campo rotulo="Situação"><select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas ({lista?.length ?? 0})</option>
          {Object.keys(ROTULO).map((k) => <option key={k} value={k}>{ROTULO[k]} ({contagem[k] ?? 0})</option>)}
        </select></Campo>
        <Campo rotulo="Ordenar por"><select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
          <option value="recentes">Alteradas recentemente</option><option value="titulo">Título (A–Z)</option><option value="status">Situação</option>
        </select></Campo>
      </div>
      <p className="suave pequeno resumo-lista" role="status">{lista === null ? "Carregando…" : `${visiveis.length} de ${lista.length} fazenda(s)`}</p>
      <div className="tabela-rolagem" role="region" aria-label="Lista de fazendas" tabIndex={0}>
        <table className="tabela tabela-responsiva">
          <thead><tr><th>Título</th><th>Situação</th><th>Fotos</th><th>CAR</th><th>Ações</th></tr></thead>
          <tbody>
            {visiveis.map((f) => (
              <tr key={f.id}>
                <td data-rotulo="Título">{f.destaque ? "★ " : ""}<Link to={`/admin/fazendas/${f.id}`}>{f.titulo}</Link>{(f.municipio || f.uf) && <><br /><span className="suave pequeno">{[f.municipio, f.uf].filter(Boolean).join(" / ")}</span></>}</td>
                <td data-rotulo="Situação">{ROTULO[f.status] ?? f.status}</td>
                <td data-rotulo="Fotos">{f.fotos}</td>
                <td data-rotulo="CAR">{f.car_codigo ? "sim" : "—"}</td>
                <td data-rotulo="Ações"><div className="acoes-linha">
                  <Link className="btn sec mini" to={`/admin/fazendas/${f.id}`}>Editar</Link>
                  {f.status !== "publicada" && <button type="button" className="btn sec mini perigo" onClick={() => void excluir(f)}>Excluir</button>}
                </div></td>
              </tr>
            ))}
            {lista !== null && visiveis.length === 0 && <tr><td colSpan={5} className="suave">{lista.length === 0 ? "Nenhuma fazenda cadastrada." : "Nenhuma fazenda encontrada com esses filtros."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    {dialogo}
    </>
  );
}
