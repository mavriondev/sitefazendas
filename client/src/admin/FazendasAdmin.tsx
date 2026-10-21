import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Erro } from "../components/Avisos";

const ROTULO: Record<string, string> = { rascunho: "Rascunho", publicada: "Publicada", vendida: "Vendida", arquivada: "Arquivada" };

export default function FazendasAdmin() {
  const [lista, setLista] = useState<any[]>([]);
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState<unknown>(null);
  const nav = useNavigate();
  useEffect(() => { void api.get("/api/admin/fazendas").then((r) => setLista(r.fazendas)).catch(setErro); }, []);
  const criar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    try { const r = await api.post("/api/admin/fazendas", { titulo }); nav(`/admin/fazendas/${r.id}`); } catch (x) { setErro(x); }
  };
  return (
    <>
      <h1>Fazendas</h1>
      <Erro erro={erro} />
      <form className="painel linha" onSubmit={criar}>
        <input required placeholder="Título da nova fazenda" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <button className="btn" type="submit">Cadastrar</button>
      </form>
      <table className="tabela">
        <thead><tr><th>Título</th><th>Status</th><th>Fotos</th><th>CAR</th><th></th></tr></thead>
        <tbody>
          {lista.map((f) => (
            <tr key={f.id}>
              <td>{f.destaque ? "★ " : ""}{f.titulo}</td><td>{ROTULO[f.status] ?? f.status}</td><td>{f.fotos}</td><td>{f.car_codigo ? "sim" : "—"}</td>
              <td><Link to={`/admin/fazendas/${f.id}`}>Editar</Link></td>
            </tr>
          ))}
          {lista.length === 0 && <tr><td colSpan={5} className="suave">Nenhuma fazenda cadastrada.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
