import { caminhoRastreavel, lerConsentimento, validarRastreamento, type ConfigRastreamento, type Consentimento } from "../../../shared/rastreamento";

type Comando = (...args: any[]) => void;
type Pixel = Comando & { queue: unknown[][]; callMethod?: Comando; push?: Pixel; loaded: boolean; version: string };
type Janela = Window & { dataLayer?: unknown[]; gtag?: Comando; fbq?: Pixel; _fbq?: Pixel };

/** Remove somente cookies dos rastreadores conhecidos, não sessão nem preferências. */
export function apagarCookiesRastreio(analytics: boolean, marketing: boolean) {
  let cookies: string;
  try { cookies = document.cookie; }
  catch { return; } // Navegadores podem negar cookies em iframes ou por política de privacidade.
  const nomes = cookies.split(";").map(c => c.trim().split("=")[0]).filter(n =>
    analytics && /^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(n) || marketing && /^_fb[pc]$/.test(n));
  const partes = location.hostname.split(".");
  const dominios = ["", ...partes.map((_, i) => partes.slice(i).join(".")).flatMap(d => [d, "." + d])];
  for (const n of nomes) for (const dominio of dominios) {
    try { document.cookie = `${n}=; Max-Age=0; path=/; SameSite=Lax${dominio ? "; domain=" + dominio : ""}`; }
    catch { /* A recusa continua válida mesmo quando o navegador impede a limpeza. */ }
  }
}

export function criarRastreadores(w: Janela = window) {
  let ga = "", meta = "", ultimaGa = "", ultimaMeta = "";
  const carregar = (id: string, src: string) => {
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id; s.async = true; s.src = src;
    s.onerror = () => window.dispatchEvent(new CustomEvent("gramogol:tracking-error", { detail: id }));
    document.head.appendChild(s);
  };
  const parar = () => {
    if (ga) {
      (w as unknown as Record<string, unknown>)["ga-disable-" + ga] = true;
      w.gtag?.("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    }
    if (meta) w.fbq?.("consent", "revoke");
    document.getElementById("gramogol-ga4")?.remove();
    document.getElementById("gramogol-meta")?.remove();
    // Remover a tag não descarrega bibliotecas já executadas: o chamador recarrega.
    apagarCookiesRastreio(!!ga, !!meta);
  };
  return {
    temRastreadores: () => !!ga || !!meta,
    atualizar(c: ConfigRastreamento, consent: Consentimento | null, caminho: string): boolean {
      const valido = !validarRastreamento(c) && caminhoRastreavel(caminho);
      const autorizado = consent && lerConsentimento(JSON.stringify(consent));
      const novoGa = valido && c.ga4_ativo && autorizado?.analytics ? c.ga4_id : "";
      const novoMeta = valido && c.meta_pixel_ativo && autorizado?.marketing ? c.meta_pixel_id : "";
      if (ga && ga !== novoGa || meta && meta !== novoMeta) { parar(); return true; }
      if (novoGa && !ga) {
        ga = novoGa;
        w.dataLayer = w.dataLayer || [];
        w.gtag = w.gtag || function () { w.dataLayer!.push(arguments); };
        w.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
        w.gtag("js", new Date());
        w.gtag("config", ga, {
          send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
          page_location: location.origin + caminho, page_referrer: "", cookie_expires: 15552000,
        });
        carregar("gramogol-ga4", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`);
      }
      if (novoMeta && !meta) {
        meta = novoMeta;
        if (!w.fbq) {
          const f = function (...args: unknown[]) {
            if (f.callMethod) f.callMethod(...args); else f.queue.push(args);
          } as Pixel;
          f.queue = []; f.push = f; f.loaded = true; f.version = "2.0";
          w.fbq = w._fbq = f;
        }
        w.fbq("consent", "grant");
        w.fbq("set", "autoConfig", false, meta);
        w.fbq("init", meta);
        carregar("gramogol-meta", "https://connect.facebook.net/en_US/fbevents.js");
      }
      // Um evento por navegação, sem repetir em refetch, focus ou renderização.
      if (novoGa && ultimaGa !== caminho) {
        ultimaGa = caminho;
        w.gtag?.("set", { page_location: location.origin + caminho, page_referrer: "" });
        w.gtag?.("event", "page_view", { send_to: ga, page_location: location.origin + caminho, page_referrer: "" });
      }
      if (novoMeta && ultimaMeta !== caminho) {
        ultimaMeta = caminho; w.fbq?.("trackSingle", meta, "PageView");
      }
      return false;
    },
    parar,
  };
}
