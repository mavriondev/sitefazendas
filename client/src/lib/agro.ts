import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

export function dataBr(iso: string | null | undefined, comHora = false): string {
  if (!iso) return "data não informada";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  if (isNaN(d.getTime())) return "data não informada";
  return d.toLocaleString("pt-BR", comHora ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" });
}

export function useCarga<T>(url: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [carregando, setCarregando] = useState(!!url);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!url) return;
    let ativo = true;
    setCarregando(true); setErro(null);
    const carregar = () => api.get<T>(url).then(r => { if (ativo) { setDados(r); setErro(null); } }).catch(e => { if (ativo) setErro(e); }).finally(() => { if (ativo) setCarregando(false); });
    void carregar();
    // Dados públicos podem mudar por importação automática ou por outra sessão.
    // Nunca atualizar o formulário administrativo por trás de uma edição.
    const timer = url.startsWith("/api/public/") ? window.setInterval(carregar, 15000) : undefined;
    return () => { ativo = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [url, tentativa]);
  const recarregar = useCallback(() => setTentativa(n => n + 1), []);
  return { dados, erro, carregando, recarregar };
}
