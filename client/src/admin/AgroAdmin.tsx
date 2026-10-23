import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Erro, Ok } from "../components/Avisos";
import type { AgroAdmin as Dados, ConfigAgro, NoticiaAgro } from "../../../shared/agro";
import { dataBr, useCarga } from "../lib/agro";
import "../components/Mercado.css";

const OPCOES: Array<[keyof ConfigAgro, string]> = [
  ["noticias_ativas", "Seção de notícias"], ["cotacoes_ativas", "Seção do dólar PTAX"],
  ["mapa_ativo", "Fonte: Ministério da Agricultura (MAPA)"], ["canal_rural_ativo", "Fonte: Canal Rural"],
];

function Linha({ n, onSalvo }: { n: NoticiaAgro; onSalvo: (n: NoticiaAgro) => void }) {
  const base = { chamada: n.chamada, resumo: n.resumo, ordem: n.ordem, ativo: n.ativo };
  const [f, setF] = useState(base);
  const anterior = useRef(base);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const velha = anterior.current;
    const nova = { chamada: n.chamada, resumo: n.resumo, ordem: n.ordem, ativo: n.ativo };
    setF(atual => JSON.stringify(atual) === JSON.stringify(velha) ? nova : atual);
    anterior.current = nova;
  }, [n]);
  const sujo = JSON.stringify(f) !== JSON.stringify(base);
  const salvar = async () => {
    setOcupado(true); setErro(null); setOk(false);
    try { const r = await api.put<{ noticia: NoticiaAgro }>(`/api/admin/noticias/${n.id}`, { ...f, ordem: Number(f.ordem) || 0 }); onSalvo(r.noticia); setOk(true); }
    catch (e) { setErro(e); } finally { setOcupado(false); }
  };
  return <div className="mk-ad-linha">
    <div><strong>{n.titulo}</strong><div className="mk-meta"><span>{n.fonte_nome}</span><span>{dataBr(n.publicado_em)}</span><span>{n.formato === "integral" ? "Integral" : "Resumo"}</span><a href={`/noticias/${n.slug}`} target="_blank" rel="noopener noreferrer">Ver no site</a></div></div>
    <label>Chamada<textarea rows={2} value={f.chamada} onChange={e => setF({ ...f, chamada: e.target.value })} /></label>
    <label>Resumo editorial<textarea rows={3} value={f.resumo} onChange={e => setF({ ...f, resumo: e.target.value })} /></label>
    <div className="mk-ad-acoes">
      <label>Ordem<input type="number" value={f.ordem} onChange={e => setF({ ...f, ordem: e.target.value as unknown as number })} /></label>
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} />Ativa</label>
      <button className="btn" disabled={!sujo || ocupado} onClick={salvar}>{ocupado ? "Salvando..." : "Salvar"}</button>
      <button className="btn secundario" disabled={!sujo || ocupado} onClick={() => setF(base)}>Cancelar</button>
      <span className="mk-nota">{n.ativo ? "Publicada" : "Oculta"}</span>
    </div>
    {erro != null && <Erro erro={erro} />}{ok && !sujo && <Ok>Salvo.</Ok>}
  </div>;
}

export default function AgroAdmin() {
  const { dados, erro, carregando, recarregar } = useCarga<Dados>("/api/admin/agro");
  const [cfg, setCfg] = useState<ConfigAgro | null>(null);
  const [noticias, setNoticias] = useState<NoticiaAgro[]>([]);
  const [estado, setEstado] = useState<Dados["estado"] | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<"" | "cfg" | "ref">("");
  useEffect(() => { if (dados) { setCfg(dados.config); setNoticias(dados.noticias); setEstado(dados.estado); } }, [dados]);
  if (carregando && !dados) return <div aria-busy="true"><div className="mk-card mk-skel" /></div>;
  if (!dados || !cfg) return <div><Erro erro={erro ?? new Error("Erro")} /><button className="btn" onClick={recarregar}>Tentar de novo</button></div>;
  const sujo = !!dados && JSON.stringify(cfg) !== JSON.stringify(dados.config);
  const salvarCfg = async () => {
    setBusy("cfg"); setErr(null); setMsg("");
    try { const r = await api.put<{ config: ConfigAgro }>("/api/admin/agro", cfg); setCfg(r.config); setMsg("Configuração salva."); recarregar(); }
    catch (e) { setErr(e); } finally { setBusy(""); }
  };
  const atualizar = async () => {
    setBusy("ref"); setErr(null); setMsg("");
    try { const r = await api.post<{ estado: Dados["estado"] }>("/api/admin/agro/atualizar"); setEstado(r.estado); setMsg(r.estado.falhas.length ? "Atualização concluída com falhas." : "Atualização concluída."); recarregar(); }
    catch (e) { setErr(e); } finally { setBusy(""); }
  };
  return <div>
    <h1>Notícias e dólar</h1>
    {msg && <Ok>{msg}</Ok>}{err != null && <Erro erro={err} />}{erro != null && <Erro erro={erro} />}
    <h2>Fontes e seções</h2>
    <div className="mk-ad-linha">
      {OPCOES.map(([k, r]) => <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 15 }}><input type="checkbox" checked={cfg[k]} disabled={busy !== ""} onChange={e => setCfg({ ...cfg, [k]: e.target.checked })} />{r}</label>)}
      <div className="mk-ad-acoes">
        <button className="btn" disabled={!sujo || busy !== ""} onClick={salvarCfg}>{busy === "cfg" ? "Salvando..." : "Salvar configuração"}</button>
        <button className="btn secundario" disabled={!sujo || busy !== ""} onClick={() => dados && setCfg(dados.config)}>Cancelar</button>
      </div>
    </div>
    <h2>Atualização</h2>
    <div className="mk-ad-linha">
      <span>Última atualização: {estado?.atualizado_em ? dataBr(estado.atualizado_em, true) : "nunca"}</span>
      {estado && estado.falhas.length > 0 && <div className="mk-aviso" role="alert"><strong>Falhas:</strong><ul>{estado.falhas.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <div className="mk-ad-acoes"><button className="btn" disabled={busy !== "" || sujo} onClick={atualizar}>{busy === "ref" ? "Atualizando..." : "Atualizar agora"}</button>{sujo && <span>Salve ou cancele as alterações das fontes antes de atualizar.</span>}</div>
    </div>
    <h2>Notícias importadas ({noticias.length})</h2>
    {noticias.length === 0 ? <p className="mk-vazio">Nenhuma notícia importada ainda. Use Atualizar agora.</p>
      : noticias.map(n => <Linha key={n.id} n={n} onSalvo={u => setNoticias(l => l.map(x => x.id === u.id ? u : x))} />)}
  </div>;
}
