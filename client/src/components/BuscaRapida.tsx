import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Search } from "lucide-react";

export function BuscaRapida() {
  const nav = useNavigate();
  const [op, setOp] = useState<{ regioes: string[]; culturas: string[] }>({ regioes: [], culturas: [] });
  const [f, setF] = useState({ regiao: "", cultura: "", area_min: "", area_max: "" });
  useEffect(() => { void api.get("/api/public/filtros").then(setOp).catch(() => {}); }, []);
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v.trim()) p.set(k, v.trim());
    nav(`/fazendas${p.toString() ? `?${p}` : ""}`);
  };
  return (
    <section className="ga-search-band" aria-label="Busca de fazendas">
      <div className="ga-wrap">
      <form className="ga-search ga-search-live" onSubmit={enviar} aria-label="Buscar fazendas">
        <div><label htmlFor="bh-regiao">Região</label><select id="bh-regiao" title={f.regiao || "Todas as regiões"} value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })}><option value="">Todas</option>{op.regioes.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="bh-cultura">Cultura</label><select id="bh-cultura" title={f.cultura || "Todas as culturas"} value={f.cultura} onChange={(e) => setF({ ...f, cultura: e.target.value })}><option value="">Todas</option>{op.culturas.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="bh-amin">Área mínima (ha)</label><input id="bh-amin" inputMode="decimal" placeholder="Sem mínimo" value={f.area_min} onChange={(e) => setF({ ...f, area_min: e.target.value })} /></div>
        <div><label htmlFor="bh-amax">Área máxima (ha)</label><input id="bh-amax" inputMode="decimal" placeholder="Sem máximo" value={f.area_max} onChange={(e) => setF({ ...f, area_max: e.target.value })} /></div>
        <button className="ga-btn ga-btn--green" type="submit"><Search aria-hidden="true"/>Buscar fazendas</button>
      </form>
      </div>
    </section>
  );
}
