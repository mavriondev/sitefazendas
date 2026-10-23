import { useState } from "react";
import { api } from "../api";
import { useSite } from "../contexto";
import { Erro, Ok } from "./Avisos";
import { Link } from "react-router-dom";
import { useConteudo } from "./Conteudo";

/** Formulário de contato geral ou de venda de fazenda (tipo="anuncio"). */
export function FormContato({ tipo }: { tipo: "contato" | "anuncio" }) {
  const { usuario } = useSite();
  const {texto:t}=useConteudo("formularios");
  const [v, setV] = useState({ nome: usuario?.nome ?? "", whatsapp: "", email: usuario?.email ?? "", mensagem: "", regiao_fazenda: "", area_fazenda: "", car_fazenda: "", culturas_fazenda: "", website: "" });
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [env, setEnv] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setEnv(true);
    try { await api.post("/api/public/contato", { ...v, tipo }); setOk(true); } catch (x) { setErro(x); } finally { setEnv(false); }
  };
  if (ok) return <Ok>{t(tipo === "anuncio" ? "confirmacoes.venda" : "confirmacoes.contato")}</Ok>;
  return (
    <form className="painel" onSubmit={enviar}>
      <Erro erro={erro} />
      <div className="filtros">
        <div><label htmlFor="f-nome">{t("rotulos.nome")}</label><input id="f-nome" required minLength={2} maxLength={120} value={v.nome} onChange={set("nome")} autoComplete="name" /></div>
        <div><label htmlFor="f-wa">{t("rotulos.whatsapp")}</label><input id="f-wa" required maxLength={32} inputMode="tel" value={v.whatsapp} onChange={set("whatsapp")} autoComplete="tel" /></div>
        <div><label htmlFor="f-em">{t("rotulos.email")}</label><input id="f-em" type="email" maxLength={200} value={v.email} onChange={set("email")} autoComplete="email" /></div>
      </div>
      {tipo === "anuncio" && (
        <>
          <h3>{t("rotulos.fazenda")}</h3>
          <div className="filtros">
            <div><label htmlFor="f-reg">{t("rotulos.regiao")}</label><input id="f-reg" maxLength={120} value={v.regiao_fazenda} onChange={set("regiao_fazenda")} /></div>
            <div><label htmlFor="f-area">{t("rotulos.area")}</label><input id="f-area" maxLength={40} placeholder={t("rotulos.area_exemplo")} value={v.area_fazenda} onChange={set("area_fazenda")} /></div>
            <div><label htmlFor="f-cult">{t("rotulos.culturas")}</label><input id="f-cult" maxLength={120} value={v.culturas_fazenda} onChange={set("culturas_fazenda")} /></div>
            <div><label htmlFor="f-car">{t("rotulos.car")}</label><input id="f-car" maxLength={60} value={v.car_fazenda} onChange={set("car_fazenda")} /></div>
          </div>
          <p className="suave pequeno">{t("orientacoes.car_opcional")}</p>
        </>
      )}
      <label htmlFor="f-msg">{t("rotulos.mensagem")}</label>
      <textarea id="f-msg" rows={5} maxLength={1000} value={v.mensagem} onChange={set("mensagem")} required={tipo === "contato"} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} value={v.website} onChange={set("website")} />
      <p className="suave pequeno">{t("orientacoes.privacidade")} <Link to="/privacidade">{t("orientacoes.link_privacidade")}</Link></p>
      <button className="btn" disabled={env} type="submit">{env ? "Enviando…" : t(tipo === "anuncio" ? "rotulos.enviar_venda" : "rotulos.enviar_contato")}</button>
    </form>
  );
}
