import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";
import { apagarCookiesRastreio, criarRastreadores } from "../lib/rastreamento";
import { CHAVE_CONSENTIMENTO, DURACAO_CONSENTIMENTO, caminhoRastreavel, lerConsentimento, rastreamentoPadrao, validarRastreamento, type ConfigRastreamento, type Consentimento } from "../../../shared/rastreamento";
import "./ConsentimentoCookies.css";

const lerEscolha = () => { try { return lerConsentimento(localStorage.getItem(CHAVE_CONSENTIMENTO)); } catch { return null; } };
export function ConsentimentoCookies() {
  const { pathname } = useLocation();
  const publico = caminhoRastreavel(pathname);
  const [cfg, setCfg] = useState<ConfigRastreamento | null>(null);
  const [escolha, setEscolha] = useState<Consentimento | null>(lerEscolha);
  const [aberto, setAberto] = useState(false);
  const [personalizar, setPersonalizar] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [aviso, setAviso] = useState("");
  const botaoPreferencias = useRef<HTMLButtonElement>(null);
  const rastreadores = useRef<ReturnType<typeof criarRastreadores> | null>(null);
  if (!rastreadores.current) rastreadores.current = criarRastreadores();
  useEffect(() => {
    if (!publico) { setCfg(null); return; }
    let ativo = true, sequencia = 0;
    const atualizar = async () => {
      const seq = ++sequencia;
      try {
        const c = await api.get<ConfigRastreamento>("/api/public/rastreamento");
        if (ativo && seq === sequencia) setCfg(validarRastreamento(c) ? rastreamentoPadrao() : c);
      } catch { if (ativo && seq === sequencia) setCfg(rastreamentoPadrao()); }
    };
    const foco = () => { if (document.visibilityState === "visible") void atualizar(); };
    const sync = (e: StorageEvent) => {
      if (e.key === CHAVE_CONSENTIMENTO || e.key === null) { setEscolha(lerEscolha()); setAberto(false); }
      if (e.key === "gramogol:rastreamento-atualizado") void atualizar();
    };
    void atualizar();
    const timer = window.setInterval(() => { setEscolha(atual => atual && !lerConsentimento(JSON.stringify(atual)) ? null : atual); foco(); }, 30000);
    window.addEventListener("focus", foco);
    document.addEventListener("visibilitychange", foco);
    window.addEventListener("gramogol:rastreamento-atualizado", foco);
    window.addEventListener("storage", sync);
    return () => { ativo = false; clearInterval(timer); window.removeEventListener("focus", foco); document.removeEventListener("visibilitychange", foco); window.removeEventListener("gramogol:rastreamento-atualizado", foco); window.removeEventListener("storage", sync); };
  }, [publico, pathname]);
  useEffect(() => {
    if (!escolha) apagarCookiesRastreio(true, true);
    if (rastreadores.current!.atualizar(cfg || rastreamentoPadrao(), escolha, pathname)) location.reload();
  }, [cfg, escolha, pathname]);
  useEffect(() => {
    // Entrada por link interno em área privada deve descartar o contexto das tags.
    const clique = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
      const u = new URL(a.href);
      if (u.origin === location.origin && !caminhoRastreavel(u.pathname) && rastreadores.current!.temRastreadores()) {
        e.preventDefault(); e.stopPropagation(); rastreadores.current!.parar(); location.assign(u.href);
      }
    };
    document.addEventListener("click", clique, true);
    return () => {
      document.removeEventListener("click", clique, true);
      if (!caminhoRastreavel(location.pathname) && rastreadores.current!.temRastreadores()) {
        rastreadores.current!.parar(); location.reload();
      }
    };
  }, []);
  const salvar = (a: boolean, m: boolean) => {
    const c: Consentimento = { versao: 1, analytics: a && !!cfg?.ga4_ativo, marketing: m && !!cfg?.meta_pixel_ativo, expira: Date.now() + DURACAO_CONSENTIMENTO };
    try { localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify(c)); setAviso(""); }
    catch { setAviso("A preferência vale nesta página. O navegador não permitiu lembrá-la para a próxima visita."); }
    if (!c.analytics || !c.marketing) apagarCookiesRastreio(!c.analytics, !c.marketing);
    setEscolha(c); setAberto(false);
    if (rastreadores.current!.atualizar(cfg || rastreamentoPadrao(), c, pathname)) location.reload();
    else botaoPreferencias.current?.focus();
  };
  const abrir = () => { setAnalytics(!!escolha?.analytics); setMarketing(!!escolha?.marketing); setPersonalizar(true); setAberto(true); };
  if (!publico || !cfg) return null;
  const ativo = cfg.ga4_ativo || cfg.meta_pixel_ativo;
  return <>
    <button ref={botaoPreferencias} type="button" className="cookie-preferencias" onClick={abrir}>Preferências de cookies</button>
    {(aberto || ativo && !escolha) && <section className="cookie-painel" role="region" aria-labelledby="cookie-titulo">
      <h2 id="cookie-titulo">Sua escolha de cookies</h2>
      <p>Os essenciais mantêm a segurança e as suas preferências. {cfg.ga4_ativo && "Com sua autorização, usamos Google Analytics para medir visitas. "}{cfg.meta_pixel_ativo && "O Pixel da Meta mede publicidade, somente se você permitir marketing. "}Você pode rejeitar os não essenciais e continuar navegando normalmente.</p>
      <Link to="/privacidade">Política de privacidade</Link>
      {personalizar && <fieldset><legend>Escolha o que autorizar</legend>
        <label><input type="checkbox" checked disabled /> Essenciais — sempre necessários</label>
        <label><input type="checkbox" checked={analytics && cfg.ga4_ativo} disabled={!cfg.ga4_ativo} onChange={e => setAnalytics(e.target.checked)} /> Analytics — Google Analytics{!cfg.ga4_ativo && " (desativado no site)"}</label>
        <label><input type="checkbox" checked={marketing && cfg.meta_pixel_ativo} disabled={!cfg.meta_pixel_ativo} onChange={e => setMarketing(e.target.checked)} /> Marketing — Pixel da Meta{!cfg.meta_pixel_ativo && " (desativado no site)"}</label>
      </fieldset>}
      <div className="cookie-acoes">
        <button type="button" onClick={() => salvar(false, false)}>Rejeitar não essenciais</button>
        {ativo && <button type="button" onClick={() => salvar(true, true)}>Aceitar todos</button>}
        {personalizar ? <button type="button" onClick={() => salvar(analytics, marketing)}>Salvar preferências</button> : <button type="button" onClick={() => setPersonalizar(true)}>Personalizar</button>}
      </div>
    </section>}
    {aviso && <p className="cookie-aviso" role="status">{aviso}</p>}
  </>;
}
