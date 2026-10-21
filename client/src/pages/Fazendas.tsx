import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type FazendaPublica } from "../api";
import { CartaoFazenda } from "../components/CartaoFazenda";

const CAMPOS = ["regiao", "cultura", "area_min", "area_max", "altitude_min", "altitude_max", "argila_min", "argila_max"] as const;

export default function Fazendas() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(CAMPOS.map((c) => [c, params.get(c) ?? ""])));
  const [dados, setDados] = useState<{ total: number; fazendas: FazendaPublica[] } | null>(null);
  const [opcoes, setOpcoes] = useState<{ regioes: string[]; culturas: string[] }>({ regioes: [], culturas: [] });
  const [erro, setErro] = useState(false);

  useEffect(() => { void api.get("/api/public/filtros").then(setOpcoes).catch(() => {}); }, []);
  useEffect(() => {
    setErro(false);
    void api.get(`/api/public/fazendas?${params.toString()}`).then(setDados).catch(() => setErro(true));
  }, [params]);

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) if (v.trim()) p.set(k, v.trim());
    setParams(p);
  };
  const campo = (nome: string, rotulo: string, ph?: string) => (
    <div><label htmlFor={nome}>{rotulo}</label><input id={nome} inputMode="decimal" placeholder={ph} value={form[nome]} onChange={(e) => setForm({ ...form, [nome]: e.target.value })} /></div>
  );
  return (
    <div className="container pagina">
      <h1>Fazendas</h1>
      <form className="painel filtros" onSubmit={aplicar}>
        <div><label htmlFor="regiao">Região</label>
          <select id="regiao" value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })}><option value="">Todas</option>{opcoes.regioes.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="cultura">Cultura</label>
          <select id="cultura" value={form.cultura} onChange={(e) => setForm({ ...form, cultura: e.target.value })}><option value="">Todas</option>{opcoes.culturas.map((r) => <option key={r}>{r}</option>)}</select></div>
        {campo("area_min", "Área mín. (ha)")}{campo("area_max", "Área máx. (ha)")}
        {campo("altitude_min", "Altitude mín. (m)")}{campo("altitude_max", "Altitude máx. (m)")}
        {campo("argila_min", "Argila mín. (%)")}{campo("argila_max", "Argila máx. (%)")}
        <div className="linha"><button className="btn" type="submit">Filtrar</button>
          <button className="btn sec" type="button" onClick={() => { setForm(Object.fromEntries(CAMPOS.map((c) => [c, ""]))); setParams(new URLSearchParams()); }}>Limpar</button></div>
      </form>
      {erro && <div className="msg erro">Não foi possível carregar as fazendas agora.</div>}
      {dados && <p className="suave">{dados.total} {dados.total === 1 ? "fazenda encontrada" : "fazendas encontradas"}</p>}
      <div className="grade">{dados?.fazendas.map((f) => <CartaoFazenda key={f.slug} f={f} />)}</div>
    </div>
  );
}
