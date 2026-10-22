import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type FazendaPublica } from "../api";
import { CartaoFazenda } from "../components/CartaoFazenda";
import { Secoes, useConteudo } from "../components/Conteudo";
import { TopoConteudo } from "./Institucional";

const POR_PAGINA = 12;
const CAMPOS = ["regiao", "cultura", "area_min", "area_max", "altitude_min", "altitude_max", "argila_min", "argila_max", "ordem"] as const;
const FLAGS = ["com_agua", "com_energia"] as const;
const ROTULOS: Record<string, string> = {
  regiao: "Região", cultura: "Cultura", area_min: "Área mín.", area_max: "Área máx.", altitude_min: "Altitude mín.", altitude_max: "Altitude máx.",
  argila_min: "Argila mín.", argila_max: "Argila máx.", com_agua: "Com água", com_energia: "Com energia",
};

export default function Fazendas() {
  const {texto:t}=useConteudo("catalogo");
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
    <Secoes pagina="catalogo" blocos={{
      topo:<TopoConteudo pagina="catalogo"/>,
      catalogo:<div className="container pagina catalogo" data-cms-secao="catalogo">
        <aside className="filtros-lateral">
          <form className="painel" onSubmit={aplicar} aria-label="Filtros">
            <h3>{t("catalogo.filtros")}</h3>
            <div><label htmlFor="regiao">{t("catalogo.regiao")}</label>
              <select id="regiao" title={form.regiao || t("catalogo.todas")} value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })}><option value="">{t("catalogo.todas")}</option>{opcoes.regioes.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div><label htmlFor="cultura">{t("catalogo.cultura")}</label>
              <select id="cultura" title={form.cultura || t("catalogo.todas")} value={form.cultura} onChange={(e) => setForm({ ...form, cultura: e.target.value })}><option value="">{t("catalogo.todas")}</option>{opcoes.culturas.map((r) => <option key={r}>{r}</option>)}</select></div>
            <fieldset><legend>{t("catalogo.grupo_area")}</legend><div className="duas">{campo("area_min", t("catalogo.minima"))}{campo("area_max", t("catalogo.maxima"))}</div></fieldset>
            <fieldset><legend>{t("catalogo.grupo_altitude")}</legend><div className="duas">{campo("altitude_min", t("catalogo.minima"))}{campo("altitude_max", t("catalogo.maxima"))}</div></fieldset>
            <fieldset><legend>{t("catalogo.grupo_argila")}</legend><div className="duas">{campo("argila_min", t("catalogo.minima"))}{campo("argila_max", t("catalogo.maxima"))}</div></fieldset>
            <fieldset><legend>{t("catalogo.infraestrutura")}</legend><div className="duas">
              <label className="linha opcao"><input type="checkbox" checked={!!flags.com_agua} onChange={(e) => setFlags({ ...flags, com_agua: e.target.checked })} />{t("catalogo.com_agua")}</label>
              <label className="linha opcao"><input type="checkbox" checked={!!flags.com_energia} onChange={(e) => setFlags({ ...flags, com_energia: e.target.checked })} />{t("catalogo.com_energia")}</label>
            </div></fieldset>
            <div className="filtro-ordem"><label htmlFor="ordem">{t("catalogo.ordem")}</label>
              <select id="ordem" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })}>
                <option value="">{t("catalogo.destaques")}</option><option value="recentes">{t("catalogo.recentes")}</option><option value="maior_area">{t("catalogo.maior")}</option><option value="menor_area">{t("catalogo.menor")}</option>
              </select></div>
            <div className="linha"><button className="btn" type="submit">{t("catalogo.aplicar")}</button><button className="btn sec" type="button" onClick={limpar}>{t("catalogo.limpar")}</button></div>
            <p className="suave pequeno">{t("catalogo.orientacao")}</p>
          </form>
        </aside>
        <section aria-live="polite">
          {ativos.length > 0 && <div className="chips">{ativos.map((k) => <button key={k} className="chip" onClick={() => remover(k)}>{t(`catalogo.${k}`) || ROTULOS[k]}{params.get(k) !== "1" ? `: ${params.get(k)}` : ""} ×</button>)}</div>}
          {erro && <div className="msg erro" role="alert">Não foi possível carregar as fazendas agora. Tente novamente.</div>}
          {!dados && !erro && <p className="suave" role="status">Carregando…</p>}
          {dados && <p className="suave">{dados.total} {dados.total === 1 ? "fazenda encontrada" : "fazendas encontradas"}</p>}
          {dados && dados.total === 0 && <div className="vazio"><h3>{t("catalogo.vazio_titulo")}</h3><p>{t("catalogo.vazio_texto")}</p><button className="btn" onClick={limpar}>{t("catalogo.limpar")}</button></div>}
          <div className="grade">{dados?.fazendas.map((f) => <CartaoFazenda key={f.slug} f={f} />)}</div>
          {dados && paginas > 1 && (
            <nav className="paginacao" aria-label="Páginas">
              <button className="btn sec" disabled={pagina <= 1} onClick={() => irPara(pagina - 1)}>Anterior</button>
              <span>Página {pagina} de {paginas}</span>
              <button className="btn sec" disabled={pagina >= paginas} onClick={() => irPara(pagina + 1)}>Próxima</button>
            </nav>
          )}
        </section>
      </div>,
    }}/>
  );
}
