import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type FazendaPublica } from "../api";
import { CartaoFazenda } from "../components/CartaoFazenda";

const POR_PAGINA = 12;
const CAMPOS = ["regiao", "cultura", "area_min", "area_max", "altitude_min", "altitude_max", "argila_min", "argila_max", "ordem"] as const;
const FLAGS = ["com_agua", "com_energia"] as const;
const ROTULOS: Record<string, string> = {
  regiao: "Região", cultura: "Cultura", area_min: "Área mín.", area_max: "Área máx.", altitude_min: "Altitude mín.", altitude_max: "Altitude máx.",
  argila_min: "Argila mín.", argila_max: "Argila máx.", com_agua: "Com água", com_energia: "Com energia",
};

export default function Fazendas() {
  const [params, setParams] = useSearchParams();
  const numeroPagina = Number(params.get("pagina"));
  const pagina = Number.isFinite(numeroPagina) ? Math.max(1, Math.floor(numeroPagina)) : 1;
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(CAMPOS.map((c) => [c, params.get(c) ?? ""])));
  const [flags, setFlags] = useState<Record<string, boolean>>(() => Object.fromEntries(FLAGS.map((c) => [c, params.get(c) === "1"])));
  const [dados, setDados] = useState<{ total: number; fazendas: FazendaPublica[] } | null>(null);
  const [opcoes, setOpcoes] = useState<{ regioes: string[]; culturas: string[] }>({ regioes: [], culturas: [] });
  const [erro, setErro] = useState(false);

  useEffect(() => { document.title = "Fazendas à venda"; void api.get("/api/public/filtros").then(setOpcoes).catch(() => {}); }, []);
  useEffect(() => {
    // Links antigos não devem aplicar um filtro que já não existe na interface.
    if (params.has("relevo")) {
      const atuais = new URLSearchParams(params);
      atuais.delete("relevo");
      setParams(atuais, { replace: true });
      return;
    }
    let ativo = true;
    setForm(Object.fromEntries(CAMPOS.map((c) => [c, params.get(c) ?? ""])));
    setFlags(Object.fromEntries(FLAGS.map((c) => [c, params.get(c) === "1"])));
    setErro(false); setDados(null);
    const q = new URLSearchParams(params);
    q.delete("pagina");
    q.set("limite", String(POR_PAGINA)); q.set("deslocamento", String((pagina - 1) * POR_PAGINA));
    void api.get(`/api/public/fazendas?${q.toString()}`)
      .then((resposta) => { if (ativo) setDados(resposta); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [params, pagina, setParams]);

  const aplicar = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) if (v.trim()) p.set(k, v.trim());
    for (const [k, v] of Object.entries(flags)) if (v) p.set(k, "1");
    setParams(p);
  };
  const limpar = () => { setForm(Object.fromEntries(CAMPOS.map((c) => [c, ""]))); setFlags({}); setParams(new URLSearchParams()); };
  const irPara = (n: number) => { const p = new URLSearchParams(params); if (n > 1) p.set("pagina", String(n)); else p.delete("pagina"); setParams(p); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remover = (k: string) => {
    const p = new URLSearchParams(params); p.delete(k); p.delete("pagina"); setParams(p);
    if (k in form) setForm({ ...form, [k]: "" }); else setFlags({ ...flags, [k]: false });
  };
  const ativos = [...CAMPOS.filter((c) => c !== "ordem" && params.get(c)), ...FLAGS.filter((c) => params.get(c) === "1")];
  const campo = (nome: string, rotulo: string) => (
    <div><label htmlFor={nome}>{rotulo}</label><input id={nome} inputMode="decimal" value={form[nome]} onChange={(e) => setForm({ ...form, [nome]: e.target.value })} /></div>
  );
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / POR_PAGINA)) : 1;

  return (
    <>
      <section className="topo-pagina"><div className="container"><span className="rotulo-sec">Catálogo</span><h1>Fazendas à venda</h1><p>Filtre por região, cultura, tamanho, altitude, argila e infraestrutura.</p></div></section>
      <div className="container pagina catalogo">
        <aside className="filtros-lateral">
          <form className="painel" onSubmit={aplicar} aria-label="Filtros">
            <h3>Filtros</h3>
            <div><label htmlFor="regiao">Região</label>
              <select id="regiao" title={form.regiao || "Todas as regiões"} value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })}><option value="">Todas</option>{opcoes.regioes.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div><label htmlFor="cultura">Cultura</label>
              <select id="cultura" title={form.cultura || "Todas as culturas"} value={form.cultura} onChange={(e) => setForm({ ...form, cultura: e.target.value })}><option value="">Todas</option>{opcoes.culturas.map((r) => <option key={r}>{r}</option>)}</select></div>
            <fieldset><legend>Área (ha)</legend><div className="duas">{campo("area_min", "Mínima")}{campo("area_max", "Máxima")}</div></fieldset>
            <fieldset><legend>Altitude (m)</legend><div className="duas">{campo("altitude_min", "Mínima")}{campo("altitude_max", "Máxima")}</div></fieldset>
            <fieldset><legend>Argila no solo (%)</legend><div className="duas">{campo("argila_min", "Mínima")}{campo("argila_max", "Máxima")}</div></fieldset>
            <fieldset><legend>Infraestrutura</legend><div className="duas">
              <label className="linha opcao"><input type="checkbox" checked={!!flags.com_agua} onChange={(e) => setFlags({ ...flags, com_agua: e.target.checked })} />Com água</label>
              <label className="linha opcao"><input type="checkbox" checked={!!flags.com_energia} onChange={(e) => setFlags({ ...flags, com_energia: e.target.checked })} />Com energia elétrica</label>
            </div></fieldset>
            <div className="filtro-ordem"><label htmlFor="ordem">Ordenar por</label>
              <select id="ordem" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })}>
                <option value="">Destaques primeiro</option><option value="recentes">Mais recentes</option><option value="maior_area">Maior área</option><option value="menor_area">Menor área</option>
              </select></div>
            <div className="linha"><button className="btn" type="submit">Filtrar</button><button className="btn sec" type="button" onClick={limpar}>Limpar</button></div>
            <p className="suave pequeno">Altitude e argila são filtradas pelas faixas mostradas nos anúncios. Só entram os dados que o corretor liberou para o público.</p>
          </form>
        </aside>
        <section aria-live="polite">
          {ativos.length > 0 && <div className="chips">{ativos.map((k) => <button key={k} className="chip" onClick={() => remover(k)}>{ROTULOS[k]}{params.get(k) !== "1" ? `: ${params.get(k)}` : ""} ×</button>)}</div>}
          {erro && <div className="msg erro" role="alert">Não foi possível carregar as fazendas agora. Tente novamente.</div>}
          {!dados && !erro && <p className="suave" role="status">Carregando…</p>}
          {dados && <p className="suave">{dados.total} {dados.total === 1 ? "fazenda encontrada" : "fazendas encontradas"}</p>}
          {dados && dados.total === 0 && <div className="vazio"><h3>Nenhuma fazenda com esses filtros</h3><p>Tente ampliar os critérios ou limpar os filtros.</p><button className="btn" onClick={limpar}>Limpar filtros</button></div>}
          <div className="grade">{dados?.fazendas.map((f) => <CartaoFazenda key={f.slug} f={f} />)}</div>
          {dados && paginas > 1 && (
            <nav className="paginacao" aria-label="Páginas">
              <button className="btn sec" disabled={pagina <= 1} onClick={() => irPara(pagina - 1)}>Anterior</button>
              <span>Página {pagina} de {paginas}</span>
              <button className="btn sec" disabled={pagina >= paginas} onClick={() => irPara(pagina + 1)}>Próxima</button>
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
