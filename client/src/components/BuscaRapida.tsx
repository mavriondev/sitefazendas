import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Search } from "lucide-react";
import { useConteudo } from "./Conteudo";
import { VAZIO, normalizarOpcoes, type OpcoesFiltros } from "./FiltrosFazendas";
import "../filtros-publicos.css";

export function BuscaRapida() {
  const nav = useNavigate();
  const {texto:t}=useConteudo("home");
  const [op, setOp] = useState<OpcoesFiltros>(VAZIO);
  const [f, setF] = useState({ uf: "", regiao_brasil: "", area_faixa: "", cultura: "" });
  useEffect(() => { void api.get("/api/public/filtros").then((o) => setOp(normalizarOpcoes(o))).catch(() => {}); }, []);
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    nav(`/fazendas${p.toString() ? `?${p}` : ""}`);
  };
  return (
    <section className="ga-search-band" aria-label="Busca de fazendas">
      <div className="ga-wrap">
      <form className="ga-search ga-search-live gf-busca" onSubmit={enviar} aria-label="Buscar fazendas">
        <div className="gf-linha">
          <div><label htmlFor="bh-uf">{t("busca.estado")}</label><select id="bh-uf" value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value, regiao_brasil: "" })}><option value="">{t("busca.todas")}</option>{op.estados.map((r) => <option key={r.uf} value={r.uf}>{r.nome}</option>)}</select></div>
          <div><label htmlFor="bh-rb">{t("busca.macrorregiao")}</label><select id="bh-rb" value={f.regiao_brasil} onChange={(e) => setF({ ...f, regiao_brasil: e.target.value, uf: "" })}><option value="">{t("busca.todas")}</option>{op.regioes_brasil.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></div>
          <div><label htmlFor="bh-area">{t("busca.area")}</label><select id="bh-area" value={f.area_faixa} onChange={(e) => setF({ ...f, area_faixa: e.target.value })}><option value="">{t("busca.qualquer")}</option>{op.faixas.area.map((r) => <option key={r.id} value={r.id}>{r.rotulo}</option>)}</select></div>
          <div><label htmlFor="bh-cultura">{t("busca.cultura")}</label><select id="bh-cultura" value={f.cultura} onChange={(e) => setF({ ...f, cultura: e.target.value })}><option value="">{t("busca.todas")}</option>{op.culturas.map((r) => <option key={r}>{r}</option>)}</select></div>
        </div>
        <button className="ga-btn ga-btn--green" type="submit"><Search aria-hidden="true"/>{t("busca.botao")}</button>
      </form>
      </div>
    </section>
  );
}
