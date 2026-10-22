import { Fragment, type ReactNode, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useSite } from "../contexto";

export function useConteudo(pagina: string) {
  const { conteudo } = useSite();
  const p = conteudo.paginas[pagina];
  return {
    texto: (chave: string) => p?.valores[chave] ?? "",
    visivel: (secao: string) => !!p && !p.ocultas.includes(secao),
    ordem: (p?.ordem ?? []).filter(id => !p.ocultas.includes(id)),
  };
}

export function Secoes({ pagina, blocos }: { pagina: string; blocos: Record<string, ReactNode> }) {
  const { ordem } = useConteudo(pagina);
  return <>{ordem.map(id => <Fragment key={id}>{blocos[id]}</Fragment>)}</>;
}

/** Links vazios removem a ação; destinos externos nunca passam pelo router. */
export function LinkConteudo({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  if (!href) return null;
  return href.startsWith("/")
    ? <Link className={className} to={href}>{children}</Link>
    : <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export const fundoConteudo = (imagem: string): CSSProperties =>
  ({ "--cms-fundo": imagem ? `url("${imagem}")` : "none" }) as CSSProperties;
