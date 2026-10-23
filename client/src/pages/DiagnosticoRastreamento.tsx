import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { criarRastreadores, CAMINHO_DIAGNOSTICO, type EstadoBiblioteca } from "../lib/rastreamento";
import { DURACAO_CONSENTIMENTO, idGa4Valido, idPixelValido, validarRastreamento, type ConfigRastreamento } from "../../../shared/rastreamento";
import "../components/DiagnosticoAdmin.css";

const ROT: Record<EstadoBiblioteca, [string, string]> = {
  "nao-iniciado": ["Não iniciado", ""], carregando: ["Carregando script", "med"], carregada: ["Script carregado (apenas onload)", "ok"],
  erro: ["Erro do navegador ao carregar", "ruim"], "tempo-esgotado": ["Tempo esgotado", "ruim"],
};
const dias = Math.round(DURACAO_CONSENTIMENTO / 86400000);

export default function DiagnosticoRastreamento() {
  const [cfg, setCfg] = useState<ConfigRastreamento | null>(null);
  const [erroCfg, setErroCfg] = useState("");
  const [, forcar] = useState(0);
  const [ga, setGa] = useState(false);
  const [meta, setMeta] = useState(false);
  const [iniciado, setIniciado] = useState(false);
  const [aviso, setAviso] = useState("");
  const ctl = useRef<ReturnType<typeof criarRastreadores> | null>(null);
  const sequencia = useRef(0);
  useEffect(() => {
    const controlador = criarRastreadores(window, () => forcar(n => n + 1), true);
    ctl.current = controlador;
    return () => { controlador.parar(); sequencia.current++; };
  }, []);

  const carregar = useCallback(async () => {
    const seq = ++sequencia.current;
    setErroCfg(""); setCfg(null);
    try {
      const c = await api.get<ConfigRastreamento>("/api/public/rastreamento");
      if (!c || typeof c !== "object" || Array.isArray(c) ||
        typeof c.ga4_id !== "string" || typeof c.meta_pixel_id !== "string" ||
        typeof c.ga4_ativo !== "boolean" || typeof c.meta_pixel_ativo !== "boolean")
        throw new Error("O servidor retornou uma configuração inválida. Recarregue ou confira o painel.");
      if (seq === sequencia.current) setCfg(c);
    }
    catch (x: any) { if (seq === sequencia.current) setErroCfg(x?.message ?? "Falha ao carregar a configuração."); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail;
      if (id === "gramogol-ga4" || id === "gramogol-meta")
        setAviso("O navegador não confirmou o carregamento de um dos scripts. Pode ser rede, CSP ou extensão; não é possível provar qual. Confira o estado de cada provedor abaixo.");
    };
    window.addEventListener("gramogol:tracking-error", h);
    return () => window.removeEventListener("gramogol:tracking-error", h);
  }, []);

  const invalida = cfg ? validarRastreamento(cfg) : null;
  const gaOk = !!cfg && cfg.ga4_ativo && idGa4Valido(cfg.ga4_id);
  const metaOk = !!cfg && cfg.meta_pixel_ativo && idPixelValido(cfg.meta_pixel_id);
  const dg = ctl.current?.diagnostico() ?? { ga4: "nao-iniciado", meta: "nao-iniciado" };

  const iniciar = () => {
    if (!cfg) return;
    // O Pixel lê a URL do documento: não deixar query/hash chegarem ao provedor.
    if (location.search || location.hash) {
      try { history.replaceState(history.state, "", CAMINHO_DIAGNOSTICO); }
      catch {
        setAviso("Não foi possível remover os parâmetros da URL. Abra esta página sem parâmetros ou fragmento antes de testar.");
        return;
      }
    }
    const c = { versao: 1 as const, analytics: ga && gaOk, marketing: meta && metaOk, expira: Date.now() + DURACAO_CONSENTIMENTO };
    if (ctl.current!.atualizar(cfg, c, CAMINHO_DIAGNOSTICO)) { location.reload(); return; }
    setIniciado(true); forcar(n => n + 1);
  };
  const revogar = () => { ctl.current!.parar(); location.reload(); };

  const linha = (nome: string, ativo: boolean, id: string, ok: boolean, marcado: boolean, est: EstadoBiblioteca) => {
    let r: [string, string];
    if (!ativo) r = ["Desligado no site", ""];
    else if (!ok) r = ["ID inválido: corrija no painel e salve", "ruim"];
    else if (!iniciado) r = [marcado ? "Consentimento ainda não autorizado (clique em Autorizar)" : "Consentimento pendente: não permitido neste teste", "med"];
    else if (!marcado) r = ["Consentimento não concedido: não carregado", ""];
    else r = ROT[est];
    return <li><strong>{nome}</strong><span className={`dg-sel ${r[1]}`}>{r[0]}</span><span className="pequeno">{id || "sem ID"}</span></li>;
  };

  return (
    <main className="dg-pagina">
      <h1>Diagnóstico de rastreamento</h1>
      <p>Esta página testa, no seu navegador, a configuração <strong>salva</strong> no painel. Se você alterou algo, salve no painel e atualize esta página (recarregar) antes de testar.</p>
      <p><a href="/admin/seo">Voltar ao painel</a> | <a href="/privacidade">Política de privacidade</a></p>
      {erroCfg && <div className="dg-erro" role="alert">{erroCfg} <div className="dg-acoes"><button type="button" onClick={() => void carregar()}>Tentar novamente</button></div></div>}
      {!cfg && !erroCfg && <p aria-busy="true">Carregando configuração...</p>}
      {cfg && <>
        {invalida && <div className="dg-erro" role="alert">{invalida} Corrija no painel e salve; provedores válidos continuam testáveis abaixo.</div>}
        <fieldset disabled={iniciado}>
          <legend>Autorização somente para este teste</legend>
          <p className="pequeno">Esta autorização não é salva e escolhas anteriores do site são ignoradas. Os provedores autorizados podem criar cookies. No site, a escolha de consentimento dura {dias} dias.</p>
          <label><input type="checkbox" checked={ga} disabled={!gaOk} onChange={e => setGa(e.target.checked)} /> Analytics: autorizo o teste do Google Analytics 4</label>
          <label><input type="checkbox" checked={meta} disabled={!metaOk} onChange={e => setMeta(e.target.checked)} /> Marketing: autorizo o teste do Pixel da Meta</label>
        </fieldset>
        <div className="dg-acoes">
          <button type="button" onClick={iniciar} disabled={iniciado || !(ga || meta)}>Autorizar e iniciar teste</button>
          <button type="button" onClick={revogar}>Revogar e encerrar teste</button>
        </div>
        <ul className="dg-lista" aria-live="polite">
          {linha("Google Analytics 4", cfg.ga4_ativo, cfg.ga4_id, gaOk, ga, dg.ga4)}
          {linha("Pixel da Meta", cfg.meta_pixel_ativo, cfg.meta_pixel_id, metaOk, meta, dg.meta)}
        </ul>
        <div role="status">{aviso && <div className="dg-erro">{aviso}</div>}</div>
        <p className="pequeno">“Carregado” significa apenas que o script terminou de baixar; não prova que gtag ou fbq funcionam nem que a conta recebeu dados. O teste solicita somente page_view / PageView, sem eventos extras nem dados pessoais adicionados pelo site ou parâmetros da URL. Os provedores podem tratar dados técnicos do navegador conforme a <a href="/privacidade">política de privacidade</a>. Cookies do provedor só são criados após sua autorização. Para reiniciar após erro, use Revogar (recarrega a página); scripts com falha não são reinseridos.</p>
        <p className="pequeno">Confirme na conta: GA4 em Tempo real (page_view, pode demorar); Meta em Gerenciador de Eventos &gt; Testar eventos (PageView). Evento na fila não é evento recebido, e bloqueadores não são contornados.</p>
      </>}
    </main>
  );
}
