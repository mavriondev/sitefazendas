import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type ConfigPublica, type Usuario } from "./api";

interface Ctx {
  config: ConfigPublica | null;
  usuario: Usuario | null;
  carregando: boolean;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
}
const C = createContext<Ctx>({ config: null, usuario: null, carregando: true, recarregar: async () => {}, sair: async () => {} });
export const useSite = () => useContext(C);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigPublica | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const recarregar = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([api.get<ConfigPublica>("/api/public/config"), api.get<{ usuario: Usuario | null }>("/api/auth/eu")]);
      setConfig(c); setUsuario(e.usuario);
    } finally { setCarregando(false); }
  }, []);
  useEffect(() => { void recarregar(); }, [recarregar]);
  const sair = useCallback(async () => { await api.post("/api/auth/sair"); setUsuario(null); }, []);
  return <C.Provider value={{ config, usuario, carregando, recarregar, sair }}>{children}</C.Provider>;
}
