import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

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
    <div className="container busca-hero">
      <form onSubmit={enviar} aria-label="Buscar fazendas">
        <div><label htmlFor="bh-regiao">Região</label><select id="bh-regiao" value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })}><option value="">Todas</option>{op.regioes.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="bh-cultura">Cultura</label><select id="bh-cultura" value={f.cultura} onChange={(e) => setF({ ...f, cultura: e.target.value })}><option value="">Todas</option>{op.culturas.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="bh-amin">Área mín. (ha)</label><input id="bh-amin" inputMode="decimal" value={f.area_min} onChange={(e) => setF({ ...f, area_min: e.target.value })} /></div>
        <div><label htmlFor="bh-amax">Área máx. (ha)</label><input id="bh-amax" inputMode="decimal" value={f.area_max} onChange={(e) => setF({ ...f, area_max: e.target.value })} /></div>
        <button className="btn" type="submit">Buscar fazendas</button>
      </form>
    </div>
  );
}
