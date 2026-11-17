import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { QuickContactForm } from "./quick";

export const NovoAtendimento = QuickContactForm;

export type MenuItem = { label: string; icon?: LucideIcon; onSelect?: () => void; href?: string; to?: string; danger?: boolean; disabled?: boolean; testid?: string };

/* "Mais ações": menu acessível por teclado (setas, Home, End, Esc). */
export function MoreActions({ items, label = "Mais ações", testid = "button-more-actions" }: { items: MenuItem[]; label?: string; testid?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const shown = items.filter(Boolean);
  useEffect(() => {
    if (!open) return;
    const first = wrap.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])");
    first?.focus();
    const out = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, [open]);
  const close = (focus = true) => { setOpen(false); if (focus) btn.current?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    const els = Array.from(wrap.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    let n = -1;
    if (e.key === "ArrowDown") n = (i + 1) % els.length;
    else if (e.key === "ArrowUp") n = (i - 1 + els.length) % els.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = els.length - 1;
    else if (e.key === "Escape") { e.preventDefault(); close(); return; }
    else if (e.key === "Tab") { setOpen(false); return; }
    if (n >= 0) { e.preventDefault(); els[n]?.focus(); }
  };
  if (!shown.length) return null;
  return (
    <div className="more" ref={wrap} onKeyDown={onKey}>
      <button ref={btn} type="button" className="btn" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} data-testid={testid}>
        <MoreHorizontal size={16} />{label}
      </button>
      {open && (
        <div className="menu" role="menu" id={id} aria-label={label}>
          {shown.map((it) => {
            const body: ReactNode = <>{it.icon && <it.icon size={16} />}<span>{it.label}</span></>;
            const cls = `menu-item ${it.danger ? "danger" : ""}`;
            const tid = it.testid;
            if (it.disabled) return <span key={it.label} role="menuitem" aria-disabled="true" tabIndex={-1} className={cls} data-testid={tid}>{body}</span>;
            if (it.to) return <Link key={it.label} role="menuitem" tabIndex={-1} className={cls} to={it.to} onClick={() => close(false)} data-testid={tid}>{body}</Link>;
            if (it.href) return <a key={it.label} role="menuitem" tabIndex={-1} className={cls} href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => close(false)} data-testid={tid}>{body}</a>;
            return <button key={it.label} type="button" role="menuitem" tabIndex={-1} className={cls} onClick={() => { close(); it.onSelect?.(); }} data-testid={tid}>{body}</button>;
          })}
        </div>
      )}
    </div>
  );
}

/* Abas acessíveis: setas, Home e End movem a seleção. */
export function Tabs<K extends string>({ tabs, value, onChange, label }: { tabs: Array<{ k: K; label: string; count?: number }>; value: K; onChange: (k: K) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.k === value);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    const k = tabs[n]!.k;
    onChange(k); refs.current[k]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button key={t.k} ref={(el) => { refs.current[t.k] = el; }} type="button" role="tab" id={`tab-${t.k}`} aria-controls={`panel-${t.k}`} aria-selected={value === t.k} tabIndex={value === t.k ? 0 : -1}
          className={`tab ${value === t.k ? "on" : ""}`} onClick={() => onChange(t.k)} data-testid={`tab-${t.k}`}>
          <span className="tab-label">{t.label}</span>{t.count !== undefined && <span className="tab-n">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
