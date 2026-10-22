import { useState } from "react";
import { api } from "../api";
import { useSite } from "../contexto";
import { Erro, Ok } from "./Avisos";

/** Formulário de contato geral ou de venda de fazenda (tipo="anuncio"). */
export function FormContato({ tipo }: { tipo: "contato" | "anuncio" }) {
  const { usuario } = useSite();
  const [v, setV] = useState({ nome: usuario?.nome ?? "", whatsapp: "", email: usuario?.email ?? "", mensagem: "", regiao_fazenda: "", area_fazenda: "", car_fazenda: "", culturas_fazenda: "", website: "" });
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [env, setEnv] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setEnv(true);
    try { await api.post("/api/public/contato", { ...v, tipo }); setOk(true); } catch (x) { setErro(x); } finally { setEnv(false); }
  };
  if (ok) return <Ok>{tipo === "anuncio" ? "Recebemos os dados da sua fazenda. Entraremos em contato pelo WhatsApp." : "Mensagem enviada. Retornaremos em breve pelo WhatsApp."}</Ok>;
  return (
    <form className="painel" onSubmit={enviar}>
      <Erro erro={erro} />
      <div className="filtros">
        <div><label htmlFor="f-nome">Nome</label><input id="f-nome" required value={v.nome} onChange={set("nome")} autoComplete="name" /></div>
        <div><label htmlFor="f-wa">WhatsApp (com DDD)</label><input id="f-wa" required inputMode="tel" value={v.whatsapp} onChange={set("whatsapp")} autoComplete="tel" /></div>
        <div><label htmlFor="f-em">E-mail (opcional)</label><input id="f-em" type="email" value={v.email} onChange={set("email")} autoComplete="email" /></div>
      </div>
      {tipo === "anuncio" && (
        <>
          <h3>Sobre a fazenda</h3>
          <div className="filtros">
            <div><label htmlFor="f-reg">Município / região</label><input id="f-reg" value={v.regiao_fazenda} onChange={set("regiao_fazenda")} /></div>
            <div><label htmlFor="f-area">Área aproximada</label><input id="f-area" placeholder="ex.: 1.200 ha" value={v.area_fazenda} onChange={set("area_fazenda")} /></div>
            <div><label htmlFor="f-cult">Culturas / atividade</label><input id="f-cult" value={v.culturas_fazenda} onChange={set("culturas_fazenda")} /></div>
            <div><label htmlFor="f-car">Código do CAR (se tiver)</label><input id="f-car" value={v.car_fazenda} onChange={set("car_fazenda")} /></div>
          </div>
          <p className="suave pequeno">Pode enviar sem o CAR: cadastramos a fazenda do mesmo jeito e completamos os dados com você.</p>
        </>
      )}
      <label htmlFor="f-msg">Mensagem</label>
      <textarea id="f-msg" rows={5} maxLength={1000} value={v.mensagem} onChange={set("mensagem")} required={tipo === "contato"} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} value={v.website} onChange={set("website")} />
      <button className="btn" disabled={env} type="submit">{env ? "Enviando…" : tipo === "anuncio" ? "Enviar minha fazenda" : "Enviar mensagem"}</button>
    </form>
  );
}
