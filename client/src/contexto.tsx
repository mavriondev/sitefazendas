import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type ConfigPublica, type Usuario } from "./api";
import { completarConteudo, conteudoPadrao, type ConteudoSite } from "../../shared/conteudo";
import { parceirosDisponiveis, type ParceiroPublico } from "../../shared/parceiros";

interface Ctx {
  parceiros: ParceiroPublico[];
  config: ConfigPublica | null;
  conteudo: ConteudoSite;
  usuario: Usuario | null;
  carregando: boolean;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
}
const C = createContext<Ctx>({ parceiros: [], config: null, conteudo: conteudoPadrao(), usuario: null, carregando: true, recarregar: async () => {}, sair: async () => {} });
export const useSite = () => useContext(C);
export function useParceiros() {
  const { parceiros, conteudo, carregando } = useSite();
  const disponiveis = !carregando && parceirosDisponiveis(parceiros, conteudo.paginas);
  return { parceiros: disponiveis ? parceiros : [], disponiveis };
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [parceiros, setParceiros] = useState<ParceiroPublico[]>([]);
  const [config, setConfig] = useState<ConfigPublica | null>(null);
  const [conteudo, setConteudo] = useState<ConteudoSite>(conteudoPadrao);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const recarregar = useCallback(async () => {
    // Falha ou nova consulta não deve promover uma página vazia.
    setParceiros([]);
    const parceirosAtualizados = api.get<{ parceiros: ParceiroPublico[] }>("/api/public/parceiros")
      .then(r => Array.isArray(r.parceiros) ? r.parceiros : [])
      .catch(() => []);
    try {
      const [c, e, conteudoAtual, lista] = await Promise.all([api.get<ConfigPublica>("/api/public/config"), api.get<{ usuario: Usuario | null }>("/api/auth/eu"), api.get<ConteudoSite>("/api/public/conteudo"), parceirosAtualizados]);
      setConfig(c); setUsuario(e.usuario); setConteudo(completarConteudo(conteudoAtual)); setParceiros(lista);
    } finally { setCarregando(false); }
  }, []);
  useEffect(() => { void recarregar(); }, [recarregar]);
  useEffect(() => {
    const atualizar = () => { if (document.visibilityState === "visible") void recarregar().catch(() => {}); };
    window.addEventListener("focus", atualizar);
    const timer = window.setInterval(atualizar, 60000);
    return () => { window.removeEventListener("focus", atualizar); window.clearInterval(timer); };
  }, [recarregar]);
  const sair = useCallback(async () => { await api.post("/api/auth/sair"); setUsuario(null); }, []);
  return <C.Provider value={{ parceiros, config, conteudo, usuario, carregando, recarregar, sair }}>{children}</C.Provider>;
}
