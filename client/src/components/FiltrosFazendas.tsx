import { useId, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import "../filtros-publicos.css";

export interface Faixa { id: string; rotulo: string }
export interface OpcoesFiltros {
  regioes: string[]; culturas: string[];
  estados: Array<{ uf: string; nome: string; regiao: string }>;
  regioes_brasil: Array<{ id: string; nome: string }>;
  faixas: { area: Faixa[]; altitude: Faixa[]; argila: Faixa[] };
}
export const VAZIO: OpcoesFiltros = { regioes: [], culturas: [], estados: [], regioes_brasil: [], faixas: { area: [], altitude: [], argila: [] } };
export const normalizarOpcoes = (o: any): OpcoesFiltros => ({
  regioes: o?.regioes ?? [], culturas: o?.culturas ?? [], estados: o?.estados ?? [], regioes_brasil: o?.regioes_brasil ?? [],
  faixas: { area: o?.faixas?.area ?? [], altitude: o?.faixas?.altitude ?? [], argila: o?.faixas?.argila ?? [] },
});

export const CHAVES = ["uf", "regiao_brasil", "area_faixa", "altitude_faixa", "argila_faixa", "com_agua", "com_energia", "cultura", "regiao"] as const;
export type Valores = Record<(typeof CHAVES)[number] | "ordem", string>;
export const valoresDe = (p: URLSearchParams): Valores =>
  Object.fromEntries([...CHAVES, "ordem" as const].map((c) => [c, p.get(c) ?? ""])) as Valores;
export const paraParams = (v: Valores) => {
  const p = new URLSearchParams();
  for (const c of [...CHAVES, "ordem" as const]) if (v[c]) p.set(c, v[c]);
  return p;
};

function Grupo({ nome, legenda, faixas, valor, onChange }: { nome: string; legenda: string; faixas: Faixa[]; valor: string; onChange: (v: string) => void }) {
  const id = useId();
  if (!faixas.length) return null;
  return (
    <fieldset>
      <legend>{legenda}</legend>
      <div className="gf-opts">
        <label className="gf-opt"><input type="radio" name={id + nome} checked={!valor} onChange={() => onChange("")} /><span>Qualquer</span></label>
        {faixas.map((f) => (
          <label className="gf-opt" key={f.id}><input type="radio" name={id + nome} checked={valor === f.id} onChange={() => onChange(f.id)} /><span>{f.rotulo}</span></label>
        ))}
      </div>
    </fieldset>
  );
}

export function FiltrosFazendas({ opcoes, valores, onChange, onAplicar, onLimpar, t }: {
  opcoes: OpcoesFiltros; valores: Valores; onChange: (v: Valores) => void; onAplicar: () => void; onLimpar: () => void;
  t: (k: string) => string;
}) {
  const [aberto, setAberto] = useState(false);
  const pid = useId();
  const set = (k: keyof Valores, v: string) => onChange({ ...valores, [k]: v });
  const geo = (k: "uf" | "regiao_brasil", v: string) => onChange({ ...valores, uf: k === "uf" ? v : "", regiao_brasil: k === "regiao_brasil" ? v : "" });
  const flag = (k: "com_agua" | "com_energia", label: string) => (
    <label className="gf-opt"><input type="checkbox" checked={valores[k] === "1"} onChange={(e) => set(k, e.target.checked ? "1" : "")} /><span>{label}</span></label>
  );
  return (
    <form className="painel gf" aria-label="Filtros" onSubmit={(e) => { e.preventDefault(); onAplicar(); setAberto(false); }}>
      <h3>{t("catalogo.filtros")}</h3>
      <div className="gf-top">
        <div>
          <label htmlFor={pid + "uf"}>{t("catalogo.estado")}</label>
          <select id={pid + "uf"} value={valores.uf} onChange={(e) => geo("uf", e.target.value)}>
            <option value="">Todos os estados</option>
            {opcoes.estados.map((e) => <option key={e.uf} value={e.uf}>{e.nome}</option>)}
          </select>
        </div>
        <p className="gf-ou">{t("catalogo.ou_regiao")}</p>
        <div>
          <label htmlFor={pid + "rb"}>{t("catalogo.macrorregiao")}</label>
          <select id={pid + "rb"} value={valores.regiao_brasil} onChange={(e) => geo("regiao_brasil", e.target.value)}>
            <option value="">Todas as regiões</option>
            {opcoes.regioes_brasil.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
      </div>
      <button type="button" className="gf-toggle" aria-expanded={aberto} aria-controls={pid + "mais"} onClick={() => setAberto(!aberto)}>
        <span>{t("catalogo.mais_filtros")}</span><ChevronDown aria-hidden="true" />
      </button>
      <div id={pid + "mais"} className={`gf-more${aberto ? " aberto" : ""}`}>
        <Grupo nome="area" legenda={t("catalogo.grupo_area")} faixas={opcoes.faixas.area} valor={valores.area_faixa} onChange={(v) => set("area_faixa", v)} />
        <Grupo nome="alt" legenda={t("catalogo.grupo_altitude")} faixas={opcoes.faixas.altitude} valor={valores.altitude_faixa} onChange={(v) => set("altitude_faixa", v)} />
        <Grupo nome="arg" legenda={t("catalogo.grupo_argila")} faixas={opcoes.faixas.argila} valor={valores.argila_faixa} onChange={(v) => set("argila_faixa", v)} />
        <fieldset><legend>{t("catalogo.infraestrutura")}</legend><div className="gf-opts">{flag("com_agua", t("catalogo.com_agua"))}{flag("com_energia", t("catalogo.com_energia"))}</div></fieldset>
        {opcoes.culturas.length > 0 && <div><label htmlFor={pid + "cu"}>{t("catalogo.cultura")}</label>
          <select id={pid + "cu"} value={valores.cultura} onChange={(e) => set("cultura", e.target.value)}>
            <option value="">{t("catalogo.todas")}</option>{opcoes.culturas.map((c) => <option key={c}>{c}</option>)}
          </select></div>}
        <div><label htmlFor={pid + "or"}>{t("catalogo.ordem")}</label>
          <select id={pid + "or"} value={valores.ordem} onChange={(e) => set("ordem", e.target.value)}>
            <option value="">{t("catalogo.destaques")}</option><option value="recentes">{t("catalogo.recentes")}</option><option value="maior_area">{t("catalogo.maior")}</option><option value="menor_area">{t("catalogo.menor")}</option>
          </select></div>
      </div>
      <div className="gf-acoes"><button className="btn" type="submit">{t("catalogo.aplicar")}</button><button className="btn sec" type="button" onClick={onLimpar}>{t("catalogo.limpar")}</button></div>
      <p className="suave pequeno">{t("catalogo.orientacao")}</p>
    </form>
  );
}

export function rotuloAtivo(k: string, v: string, o: OpcoesFiltros): string {
  const achar = (l: Faixa[]) => l.find((f) => f.id === v)?.rotulo ?? v;
  switch (k) {
    case "uf": return o.estados.find((e) => e.uf === v)?.nome ?? v;
    case "regiao_brasil": return o.regioes_brasil.find((r) => r.id === v)?.nome ?? v;
    case "area_faixa": return `Área: ${achar(o.faixas.area)}`;
    case "altitude_faixa": return `Altitude: ${achar(o.faixas.altitude)}`;
    case "argila_faixa": return `Argila: ${achar(o.faixas.argila)}`;
    case "com_agua": return "Com água";
    case "com_energia": return "Com energia";
    case "cultura": return `Cultura: ${v}`;
    default: return `Descrição: ${v}`;
  }
}
export const Remover = () => <X aria-hidden="true" />;
