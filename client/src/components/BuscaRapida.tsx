import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Search } from "lucide-react";
import { useConteudo } from "./Conteudo";

export function BuscaRapida() {
  const nav = useNavigate();
  const {texto:t}=useConteudo("home");
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
        <div><label htmlFor="bh-regiao">{t("busca.regiao")}</label><select id="bh-regiao" title={f.regiao || t("busca.todas")} value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })}><option value="">{t("busca.todas")}</option>{op.regioes.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="bh-cultura">{t("busca.cultura")}</label><select id="bh-cultura" title={f.cultura || t("busca.todas")} value={f.cultura} onChange={(e) => setF({ ...f, cultura: e.target.value })}><option value="">{t("busca.todas")}</option>{op.culturas.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="bh-amin">{t("busca.area_min")}</label><input id="bh-amin" inputMode="decimal" placeholder={t("busca.sem_minimo")} value={f.area_min} onChange={(e) => setF({ ...f, area_min: e.target.value })} /></div>
        <div><label htmlFor="bh-amax">{t("busca.area_max")}</label><input id="bh-amax" inputMode="decimal" placeholder={t("busca.sem_maximo")} value={f.area_max} onChange={(e) => setF({ ...f, area_max: e.target.value })} /></div>
        <button className="ga-btn ga-btn--green" type="submit"><Search aria-hidden="true"/>{t("busca.botao")}</button>
      </form>
      </div>
    </section>
  );
}
