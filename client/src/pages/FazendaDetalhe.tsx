import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, linkWhatsapp, type FazendaPublica } from "../api";
import { useSite } from "../contexto";
import { Erro, Ok } from "../components/Avisos";
import { MapaRegiao } from "../components/MapaRegiao";

export default function FazendaDetalhe() {
  const { slug } = useParams();
  const { config, usuario } = useSite();
  const [f, setF] = useState<FazendaPublica | null>(null);
  const [naoAchou, setNaoAchou] = useState(false);
  const [foto, setFoto] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setF(null); setNaoAchou(false); setFoto(0);
    void api.get<FazendaPublica>(`/api/public/fazendas/${slug}`).then(setF).catch(() => setNaoAchou(true));
  }, [slug]);

  useEffect(() => { if (f) document.title = `${f.titulo} — ${config?.nome_site ?? ""}`; }, [f, config]);

  if (naoAchou) return <div className="container pagina"><h1>Fazenda não encontrada</h1><Link to="/fazendas">Ver outras fazendas</Link></div>;
  if (!f) return <div className="container pagina"><p className="suave">Carregando…</p></div>;

  const url = typeof window !== "undefined" ? window.location.href : "";
  const msg = `Olá! Tenho interesse na fazenda "${f.titulo}": ${url}`;
  const wa = linkWhatsapp(f.whatsapp, msg);
  const copiar = async () => { try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão */ } };

  return (
    <div className="container pagina">
      <p><Link to="/fazendas">← Todas as fazendas</Link></p>
      <h1>{f.titulo}</h1>
      <p className="suave">{[f.regiao, f.area].filter(Boolean).join(" · ")}</p>
      <div className="detalhe-grid">
        <div>
          {f.fotos.length > 0 && (
            <div className="galeria">
              <img className="principal" src={f.fotos[foto].url} alt={f.fotos[foto].legenda ?? f.titulo} onClick={() => setZoom(true)} />
              {f.fotos[foto].legenda && <p className="suave pequeno">{f.fotos[foto].legenda}</p>}
              {f.fotos.length > 1 && <div className="miniaturas">{f.fotos.map((p, i) => (
                <img key={p.url} src={p.url} alt={p.legenda ?? `Foto ${i + 1}`} className={i === foto ? "ativa" : ""} onClick={() => setFoto(i)} />
              ))}</div>}
            </div>
          )}
          {f.descricao && <div className="painel"><h3>Sobre a fazenda</h3>{f.descricao.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>}
          {f.culturas.length > 0 && <div className="painel"><h3>Culturas</h3>{f.culturas.map((c) => <span className="etiqueta" key={c}>{c}</span>)}</div>}
          {f.atributos.length > 0 && (
            <div className="painel">
              <h3>Dados da terra</h3>
              <div className="atributos">
                {f.atributos.map((a) => (
                  <div key={a.chave}>
                    <span className="rotulo">{a.rotulo}</span>
                    <strong>{a.texto}</strong>{" "}
                    <span className={`selo ${a.confianca}`}>{a.confianca === "confirmado" ? "Confirmado" : "Indicado por fonte pública"}</span>
                  </div>
                ))}
              </div>
              <p className="suave pequeno">“Indicado” vem de bases públicas e modelos, não de medição em campo; não confirma condições reais. “Confirmado” foi verificado pelo corretor com vendedor, documento ou visita.</p>
            </div>
          )}
          {f.regiao_mapa && (
            <div className="painel">
              <h3>Região</h3>
              <MapaRegiao lat={f.regiao_mapa.lat} lon={f.regiao_mapa.lon} raioKm={f.regiao_mapa.raio_km} />
              <p className="suave pequeno">Área ampla de referência (raio de {f.regiao_mapa.raio_km} km). A fazenda fica dentro dela, mas não no centro. A localização exata é informada em atendimento.</p>
            </div>
          )}
          {f.forma && (
            <div className="painel">
              <h3>Formato aproximado</h3>
              <svg className="forma" viewBox={f.forma.viewBox} role="img" aria-label="Silhueta da propriedade, sem localização"><path d={f.forma.d} /></svg>
              <p className="suave pequeno">Silhueta ilustrativa, sem escala ou localização. Localização exata informada em atendimento.</p>
            </div>
          )}
        </div>
        <aside className="lateral">
          {f.preco && <p><span className="suave">Valor</span><br /><strong style={{ fontSize: "1.3rem" }}>{f.preco}</strong></p>}
          {wa ? <a className="btn" style={{ width: "100%", textAlign: "center" }} href={wa} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a> : null}
          <h4>Compartilhar</h4>
          <div className="linha">
            <a className="btn sec" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <button className="btn sec" onClick={copiar}>{copiado ? "Link copiado" : "Copiar link"}</button>
          </div>
          <FormContato slug={f.slug} nome={usuario?.nome ?? ""} />
          <p className="suave pequeno">{config?.aviso_intermediacao}</p>
        </aside>
      </div>
      {zoom && f.fotos[foto] && <div className="lightbox" onClick={() => setZoom(false)} role="dialog" aria-label="Foto ampliada"><img src={f.fotos[foto].url} alt={f.fotos[foto].legenda ?? f.titulo} /></div>}
    </div>
  );
}

function FormContato({ slug, nome: n0 }: { slug: string; nome: string }) {
  const [v, setV] = useState({ nome: n0, whatsapp: "", email: "", mensagem: "", website: "" });
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [env, setEnv] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setEnv(true);
    try { await api.post("/api/public/contato", { ...v, fazenda_slug: slug }); setOk(true); } catch (x) { setErro(x); } finally { setEnv(false); }
  };
  if (ok) return <Ok>Recebemos seu contato. Retornaremos pelo WhatsApp.</Ok>;
  return (
    <form onSubmit={enviar}>
      <h4>Quero ser contatado</h4>
      <Erro erro={erro} />
      <label htmlFor="c-nome">Nome</label><input id="c-nome" required value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
      <label htmlFor="c-wa">WhatsApp (com DDD)</label><input id="c-wa" required inputMode="tel" value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} />
      <label htmlFor="c-em">E-mail (opcional)</label><input id="c-em" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      <label htmlFor="c-msg">Mensagem</label><textarea id="c-msg" rows={3} maxLength={1000} value={v.mensagem} onChange={(e) => setV({ ...v, mensagem: e.target.value })} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} />
      <button className="btn" disabled={env} type="submit">{env ? "Enviando…" : "Enviar"}</button>
    </form>
  );
}
