import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type FazendaPublica } from "../api";
import { CartaoFazenda } from "../components/CartaoFazenda";
import { Secoes, useConteudo } from "../components/Conteudo";
import { FiltrosFazendas, VAZIO, CHAVES, normalizarOpcoes, paraParams, valoresDe, rotuloAtivo, Remover, type OpcoesFiltros, type Valores } from "../components/FiltrosFazendas";
import { TopoConteudo } from "./Institucional";

const POR_PAGINA = 12;
const LEGADOS = ["relevo", "area_min", "area_max", "altitude_min", "altitude_max", "argila_min", "argila_max"];
const ORDENS = ["recentes", "maior_area", "menor_area"];

export default function Fazendas() {
  const {texto:t}=useConteudo("catalogo");
  const [params, setParams] = useSearchParams();
  const numeroPagina = Number(params.get("pagina"));
  const pagina = Number.isFinite(numeroPagina) ? Math.max(1, Math.floor(numeroPagina)) : 1;
  const [form, setForm] = useState<Valores>(() => valoresDe(params));
  const [dados, setDados] = useState<{ total: number; fazendas: FazendaPublica[] } | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesFiltros>(VAZIO);
  const [erroOpcoes, setErroOpcoes] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    setErroOpcoes(false);
    void api.get("/api/public/filtros").then((o) => setOpcoes(normalizarOpcoes(o))).catch(() => setErroOpcoes(true));
  }, [tentativa]);
  useEffect(() => {
    // Links antigos com min/max ou relevo deixam de filtrar: normaliza a URL.
    if (LEGADOS.some((k) => params.has(k)) || (params.get("ordem") && !ORDENS.includes(params.get("ordem")!))) {
      const atuais = new URLSearchParams(params);
      LEGADOS.forEach((k) => atuais.delete(k));
      if (atuais.get("ordem") && !ORDENS.includes(atuais.get("ordem")!)) atuais.delete("ordem");
      setParams(atuais, { replace: true });
      return;
    }
    let ativo = true;
    setForm(valoresDe(params));
    setErro(false); setDados(null);
    const q = new URLSearchParams(params);
    q.delete("pagina");
    q.set("limite", String(POR_PAGINA)); q.set("deslocamento", String((pagina - 1) * POR_PAGINA));
    void api.get(`/api/public/fazendas?${q.toString()}`)
      .then((resposta) => { if (ativo) setDados(resposta); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [params, pagina, setParams, tentativa]);

  const aplicar = () => setParams(paraParams(form));
  const limpar = () => { setForm(valoresDe(new URLSearchParams())); setParams(new URLSearchParams()); };
  const irPara = (n: number) => { const p = new URLSearchParams(params); if (n > 1) p.set("pagina", String(n)); else p.delete("pagina"); setParams(p); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remover = (k: string) => { const p = new URLSearchParams(params); p.delete(k); p.delete("pagina"); setParams(p); };
  const ativos = CHAVES.filter((c) => params.get(c));
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / POR_PAGINA)) : 1;

  return (
    <Secoes pagina="catalogo" blocos={{
      topo:<TopoConteudo pagina="catalogo"/>,
      catalogo:<div className="container pagina catalogo" data-cms-secao="catalogo">
        <aside className="filtros-lateral">
          {erroOpcoes && <div className="msg erro gf-aviso" role="alert">Não foi possível carregar as opções de filtro. <button className="btn sec" type="button" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button></div>}
          <FiltrosFazendas opcoes={opcoes} valores={form} onChange={setForm} onAplicar={aplicar} onLimpar={limpar} t={t} />
        </aside>
        <section aria-live="polite">
          {ativos.length > 0 && <div className="gf-chips">{ativos.map((k) => <button type="button" key={k} className="chip" aria-label={`Remover filtro ${rotuloAtivo(k, params.get(k)!, opcoes)}`} onClick={() => remover(k)}>{rotuloAtivo(k, params.get(k)!, opcoes)}<Remover /></button>)}</div>}
          {erro && <div className="msg erro" role="alert">Não foi possível carregar as fazendas agora. Tente novamente. <button className="btn sec" type="button" onClick={() => setTentativa((n) => n + 1)}>Recarregar</button></div>}
          {!dados && !erro && <p className="suave" role="status">Carregando…</p>}
          {dados && <p className="suave">{dados.total} {dados.total === 1 ? "fazenda encontrada" : "fazendas encontradas"}</p>}
          {dados && dados.total === 0 && <div className="vazio"><h3>{t("catalogo.vazio_titulo")}</h3><p>{t("catalogo.vazio_texto")}</p><button className="btn" onClick={limpar}>{t("catalogo.limpar")}</button></div>}
          <div className="grade">{dados?.fazendas.map((f) => <CartaoFazenda key={f.slug} f={f} />)}</div>
          {dados && paginas > 1 && (
            <nav className="paginacao" aria-label="Páginas">
              <button type="button" className="btn sec" disabled={pagina <= 1} onClick={() => irPara(pagina - 1)}>Anterior</button>
              <span>Página {pagina} de {paginas}</span>
              <button type="button" className="btn sec" disabled={pagina >= paginas} onClick={() => irPara(pagina + 1)}>Próxima</button>
            </nav>
          )}
        </section>
      </div>,
    }}/>
  );
}
