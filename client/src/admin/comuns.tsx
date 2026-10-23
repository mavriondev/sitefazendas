import { Children, cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

/* ---------- campo com rótulo associado ---------- */

/** <Campo rotulo="Título"><input .../></Campo>: liga o rótulo ao campo (toque no rótulo e leitor de tela). */
export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  const gerado = useId();
  const filho = Children.only(children);
  const id = (isValidElement(filho) && (filho.props as { id?: string }).id) || gerado;
  const dicaId = dica ? `${id}-dica` : undefined;
  const campo = isValidElement(filho)
    ? cloneElement(filho as ReactElement<any>, { id, "aria-describedby": dicaId })
    : filho;
  return (
    <div>
      <label htmlFor={id}>{rotulo}</label>
      {campo}
      {dica && <p id={dicaId} className="suave pequeno dica-campo">{dica}</p>}
    </div>
  );
}

/* ---------- alterações não salvas ---------- */

// Um único par de ouvintes para a página inteira, mesmo com vários formulários sujos ao mesmo tempo.
const pendentes = new Set<string>();
let instalado = false;
function instalarOuvintes() {
  if (instalado || typeof window === "undefined") return;
  instalado = true;
  window.addEventListener("beforeunload", (e) => {
    if (!pendentes.size) return;
    e.preventDefault(); e.returnValue = "";
  });
  document.addEventListener("click", (e) => {
    if (!pendentes.size) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a.target === "_blank" || a.origin !== location.origin || e.defaultPrevented) return;
    if (a.pathname === location.pathname && a.search === location.search) return;
    if (!window.confirm("Há alterações não salvas. Sair desta tela e perder o que foi digitado?")) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}

/** Avisa ao sair da tela (fechar a aba, recarregar ou clicar em outro link) enquanto `sujo` for verdadeiro. */
export function useAvisoAlteracao(sujo: boolean) {
  const id = useId();
  useEffect(() => {
    instalarOuvintes();
    if (sujo) pendentes.add(id); else pendentes.delete(id);
    return () => { pendentes.delete(id); };
  }, [sujo, id]);
}

/** true quando `atual` difere de `base` (comparação por JSON, ignorando diferença entre número e texto digitado). */
export function difere(atual: unknown, base: unknown): boolean {
  const norm = (o: unknown) => JSON.stringify(o, (_k, v) => (v === null || v === undefined ? "" : typeof v === "number" ? String(v) : v));
  return norm(atual) !== norm(base);
}

/* ---------- ação com bloqueio de envio duplicado ---------- */

/**
 * Envolve uma função `acao(fn, mensagem)`: enquanto uma ação está em andamento, novas chamadas são ignoradas
 * (evita clique duplo em Salvar/Cadastrar/Enviar). `ocupado` serve para esmaecer a área e marcar aria-busy.
 */
export function useAcaoUnica<A extends any[]>(executar: (...args: A) => Promise<void>) {
  const [ocupado, setOcupado] = useState(false);
  const emAndamento = useRef(false);
  const soltar = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(soltar.current), []);
  const envolvida = useCallback(async (...args: A) => {
    if (emAndamento.current) return;
    emAndamento.current = true; clearTimeout(soltar.current); setOcupado(true);
    try { await executar(...args); } finally {
      // Pequena pausa: a lista pode ter mudado de lugar (mensagem nova, linha que sumiu) e um segundo clique
      // rápido cairia em outro botão. Durante a pausa o botão continua travado.
      soltar.current = setTimeout(() => { emAndamento.current = false; setOcupado(false); }, 450);
    }
  }, [executar]);
  return [envolvida, ocupado] as const;
}

/* ---------- confirmação acessível ---------- */

export interface PedidoConfirmacao { titulo: string; texto?: string; confirmar?: string; perigo?: boolean }

/**
 * const [confirmar, dialogo] = useConfirmar();
 * ... if (!(await confirmar({ titulo: "Excluir?", perigo: true }))) return;
 * ... renderize {dialogo} uma vez na tela.
 * Usa <dialog> nativo (foco preso, Esc cancela). Sem suporte, cai para window.confirm.
 */
export function useConfirmar() {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const ref = useRef<HTMLDialogElement | null>(null);

  const confirmar = useCallback((p: PedidoConfirmacao) => new Promise<boolean>((resolve) => {
    const d = document.createElement("dialog");
    if (typeof d.showModal !== "function") { resolve(window.confirm(p.texto ? `${p.titulo}\n\n${p.texto}` : p.titulo)); return; }
    resolver.current?.(false);
    resolver.current = resolve; setPedido(p);
  }), []);

  useEffect(() => { if (pedido) ref.current?.showModal(); }, [pedido]);

  const encerrar = (v: boolean) => { const r = resolver.current; resolver.current = null; setPedido(null); ref.current?.close(); r?.(v); };

  const dialogo = pedido ? (
    <dialog ref={ref} className="confirmar" aria-labelledby="confirmar-titulo" onCancel={(e) => { e.preventDefault(); encerrar(false); }}>
      <h2 id="confirmar-titulo">{pedido.titulo}</h2>
      {pedido.texto && <p>{pedido.texto}</p>}
      <div className="linha">
        <button type="button" className="btn sec" onClick={() => encerrar(false)} autoFocus>Cancelar</button>
        <button type="button" className={`btn ${pedido.perigo ? "perigo" : ""}`} onClick={() => encerrar(true)}>{pedido.confirmar ?? "Confirmar"}</button>
      </div>
    </dialog>
  ) : null;

  return [confirmar, dialogo] as const;
}

/* ---------- listas ---------- */

/** Avisa quando a API devolveu menos registros do que existem (limite de segurança de 500). */
export function AvisoLimite({ total, mostrados }: { total?: number; mostrados: number }) {
  if (!total || total <= mostrados) return null;
  return <div className="msg aviso" role="status">Mostrando os {mostrados} mais recentes de {total}. Os mais antigos não aparecem nesta tela.</div>;
}

/* ---------- rascunho local (recuperação ao voltar com o botão do navegador, fechar a aba por engano etc.) ---------- */

const lerRascunho = (chave: string): any => { try { const t = sessionStorage.getItem(chave); return t ? JSON.parse(t) : null; } catch { return null; } };
const gravarRascunho = (chave: string, valor: unknown | null) => { try { if (valor === null) sessionStorage.removeItem(chave); else sessionStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: segue sem recuperação */ } };

/**
 * Estado de formulário que guarda um rascunho na sessão do navegador enquanto houver alterações não salvas.
 * Ao reabrir a tela (por exemplo depois do botão Voltar), recupera o que foi digitado.
 * Dura só enquanto a aba estiver aberta (sessionStorage) e nunca vai para o servidor.
 */
export function useFormularioComRascunho<T>(chave: string, base: T) {
  const [v, setV] = useState<T>(() => { const r = lerRascunho(chave); return r && difere(r, base) ? (r as T) : base; });
  const recuperado = useRef(difere(v, base)).current;
  const sujo = difere(v, base);
  useAvisoAlteracao(sujo);
  useEffect(() => { gravarRascunho(chave, sujo ? v : null); }, [chave, v, sujo]);
  const descartar = () => { gravarRascunho(chave, null); setV(base); };
  // Limpa só a versão enviada: digitação mais nova durante o envio continua recuperável.
  const confirmarSalvo = () => {
    if (!difere(lerRascunho(chave), v)) gravarRascunho(chave, null);
  };
  return { v, setV, sujo, recuperado, descartar, confirmarSalvo };
}
