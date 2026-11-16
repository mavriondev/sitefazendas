import { useSyncExternalStore } from "react";

/* Preferências de tela, guardadas neste aparelho. Servem para esconder o que a pessoa não usa. */
export interface Prefs { resumo: boolean; ligar: boolean; lembrar: boolean; observacao: boolean; porEtapa: boolean }
export const PREFS_PADRAO: Prefs = { resumo: true, ligar: true, lembrar: true, observacao: true, porEtapa: false };
const KEY = "crm.prefs.v1";
let cache: Prefs | null = null;
const subs = new Set<() => void>();
function read(): Prefs {
  if (cache) return cache;
  let saved: Partial<Prefs> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { /* sem armazenamento: usa o padrão */ }
  cache = { ...PREFS_PADRAO, ...Object.fromEntries(Object.entries(saved).filter(([k, v]) => k in PREFS_PADRAO && typeof v === "boolean")) };
  return cache;
}
export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  cache = { ...read(), [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignora */ }
  subs.forEach((f) => f());
}
export function resetPrefs() { cache = { ...PREFS_PADRAO }; try { localStorage.removeItem(KEY); } catch { /* ignora */ } subs.forEach((f) => f()); }
export const usePrefs = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, read, read);
