import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ErroApi } from "../api";
import { useSite } from "../contexto";
import { Erro, Ok, Aviso } from "../components/Avisos";

interface Res { token: string; uf: string | null; area: string | null; altitude: string | null; argila: string | null }
const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
const n = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

export default function Pesquisa() {
  const { config, usuario, carregando } = useSite();
  const [f, setF] = useState({ uf: "", area_min: "", area_max: "", altitude_min: "", altitude_max: "", argila_min: "", argila_max: "" });
  const [res, setRes] = useState<{ total: number; resultados: Res[] } | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [pedidos, setPedidos] = useState<Set<string>>(new Set());
  useEffect(() => { document.title = "Pesquisa de terras"; }, []);

  if (carregando) return null;
  if (!config?.modulo_pesquisa_ativo) return <div className="container pagina"><h1>Pesquisa indisponível</h1><p className="suave">Este recurso não está disponível no momento.</p></div>;
  if (!usuario) return <div className="container pagina"><h1>Pesquisa de terras</h1><p>Para pesquisar, <Link to="/entrar?de=/pesquisa">entre</Link> ou <Link to="/cadastro">crie sua conta</Link>.</p></div>;

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setBusy(true);
    try {
      setRes(await api.post("/api/pesquisa/buscar", {
        uf: f.uf, area_min: n(f.area_min), area_max: n(f.area_max), altitude_min: n(f.altitude_min), altitude_max: n(f.altitude_max),
        argila_min: n(f.argila_min), argila_max: n(f.argila_max),
      }));
    } catch (x) { setErro(x); setRes(null); } finally { setBusy(false); }
  };
  const interesse = async (token: string) => {
    try { await api.post("/api/pesquisa/interesse", { token }); setPedidos(new Set(pedidos).add(token)); }
    catch (x) { setErro(x instanceof ErroApi ? x : new Error("Erro")); }
  };
  const campo = (k: keyof typeof f, r: string) => <div><label htmlFor={k}>{r}</label><input id={k} inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;

  return (
    <div className="container pagina">
      <h1>Pesquisa de terras</h1>
      <p className="suave">Encontre terras por estado, área, altitude e argila. Por proteção dos proprietários, a localização e os dados completos só são liberados em atendimento direto.</p>
      <form className="painel filtros" onSubmit={buscar}>
        <div><label htmlFor="uf">Estado</label>
          <select id="uf" required value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })}><option value="">Escolha</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></div>
        {campo("area_min", "Área mín. (ha)")}{campo("area_max", "Área máx. (ha)")}
        {campo("altitude_min", "Altitude mín. (m)")}{campo("altitude_max", "Altitude máx. (m)")}
        {campo("argila_min", "Argila mín. (%)")}{campo("argila_max", "Argila máx. (%)")}
        <button className="btn" disabled={busy} type="submit">{busy ? "Buscando…" : "Pesquisar"}</button>
      </form>
      <Erro erro={erro} />
      {res && (
        <>
          <p>{res.total} {res.total === 1 ? "terra encontrada" : "terras encontradas"}. Os filtros são aproximados e os valores vêm de modelos e bases públicas, sem confirmação em campo.</p>
          {res.resultados.length === 0 && <Aviso>Nenhum resultado. Tente ampliar os critérios.</Aviso>}
          <div className="grade">
            {res.resultados.map((r, i) => (
              <div className="cartao fazenda-card" key={r.token}><div className="corpo">
                <h3>Terra {i + 1} · {r.uf ?? "—"}</h3>
                <div className="atributos">
                  <div><span className="rotulo">Área</span><strong>{r.area ?? "sem dado"}</strong></div>
                  <div><span className="rotulo">Altitude</span><strong>{r.altitude ?? "sem dado"}</strong></div>
                  <div><span className="rotulo">Argila</span><strong>{r.argila ?? "sem dado"}</strong></div>
                </div>
                {pedidos.has(r.token) ? <Ok>Pedido enviado. Entraremos em contato.</Ok> : <button className="btn" onClick={() => interesse(r.token)}>Quero saber mais</button>}
              </div></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
