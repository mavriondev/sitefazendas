import { RotateCcw } from "lucide-react";
import { PREFS_PADRAO, resetPrefs, setPref, usePrefs, type Prefs } from "./prefs";

const OPCOES: Array<{ k: keyof Prefs; titulo: string; ajuda: string }> = [
  { k: "resumo", titulo: "Resumo no topo", ajuda: "Atrasados, hoje, sem retorno e ativas." },
  { k: "ligar", titulo: "Botão Ligar", ajuda: "Útil se você também atende por telefone." },
  { k: "lembrar", titulo: "Lembrar de retornar", ajuda: "Botões Amanhã, 3 dias, 1 semana." },
  { k: "observacao", titulo: "Observação", ajuda: "Campo de texto opcional em cada negociação." },
  { k: "porEtapa", titulo: "Quadro “Por etapa”", ajuda: "Contagem de negociações em cada etapa." },
];

/** Liga e desliga partes da tela. Vale só neste aparelho. */
export function Personalizar() {
  const prefs = usePrefs();
  const mudou = (Object.keys(PREFS_PADRAO) as Array<keyof Prefs>).some((k) => prefs[k] !== PREFS_PADRAO[k]);
  return (
    <section className="card" data-testid="card-personalizar">
      <div className="card-h"><h2>Personalizar a tela</h2></div>
      <p className="small muted" style={{ marginTop: 0 }}>Esconda o que você não usa. Vale só neste aparelho.</p>
      <div className="switches">
        {OPCOES.map((o) => (
          <label key={o.k} className="switch">
            <span><strong>{o.titulo}</strong><span className="small muted">{o.ajuda}</span></span>
            <input type="checkbox" role="switch" checked={prefs[o.k]} onChange={(e) => setPref(o.k, e.target.checked)} data-testid={`switch-${o.k}`} />
          </label>
        ))}
      </div>
      {mudou && <button className="btn sm" style={{ marginTop: 12 }} onClick={resetPrefs} data-testid="button-reset-prefs"><RotateCcw size={14} />Voltar ao padrão</button>}
    </section>
  );
}
