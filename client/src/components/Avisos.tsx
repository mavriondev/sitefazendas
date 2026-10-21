import type { ReactNode } from "react";

export function Erro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const e: any = erro;
  return (
    <div className="msg erro" role="alert">
      {e?.message ?? "Erro inesperado."}
      {Array.isArray(e?.detalhes) && e.detalhes.length > 0 && <ul>{e.detalhes.map((d: string, i: number) => <li key={i}>{d}</li>)}</ul>}
    </div>
  );
}
export const Ok = ({ children }: { children: ReactNode }) => <div className="msg ok" role="status">{children}</div>;
export const Aviso = ({ children }: { children: ReactNode }) => <div className="msg aviso">{children}</div>;
