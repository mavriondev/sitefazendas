import { useState } from "react";
import { AlertTriangle, MessageCircle, Phone } from "lucide-react";
import { api, ETAPAS, ROTULOS, type Deal, type Etapa } from "./api";
import { isClosedStage } from "../shared";
import { usePrefs } from "./prefs";
import { ErrorBox, useAction, useDirty, waLink } from "./ui";
export { QuickContactForm } from "./attendance-form";

/* ---------- datas ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
export const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** Data local daqui a `days` dias, às 9h, no formato do campo datetime-local. */
export function daysFromNow(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0);
  return toLocal(d.toISOString());
}
const ATALHOS = [{ label: "Amanhã", days: 1 }, { label: "Em 3 dias", days: 3 }, { label: "Em 1 semana", days: 7 }, { label: "Em 1 mês", days: 30 }];

/** Botões que preenchem o próximo retorno com um toque (sempre às 9h). */
export function QuickReturn({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips" role="group" aria-label="Retorno rápido">
      {ATALHOS.map((a) => {
        const v = daysFromNow(a.days);
        return <button type="button" key={a.days} className={`chip ${value === v ? "on" : ""}`} onClick={() => onChange(v)} data-testid={`chip-return-${a.days}d`}>{a.label}</button>;
      })}
    </div>
  );
}

/* ---------- WhatsApp ---------- */
export const waMessage = (nome: string, fazenda?: string | null) =>
  `Olá, ${nome.trim().split(/\s+/)[0]}! Aqui é da Gramogol${fazenda ? `, sobre a ${fazenda}` : ""}.`;

/** Botões de contato, um ao lado do outro: a conversa acontece no WhatsApp. */
export function DealContactButtons({ d }: { d: Deal }) {
  const { ligar } = usePrefs();
  const tel = d.contato_telefone;
  if (!tel) return null;
  return (
    <div className="deal-actions">
      <a className="icon-btn wa" href={waLink(tel, waMessage(d.contato_nome, d.fazenda_titulo))} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp com ${d.contato_nome}`} title="WhatsApp" data-testid={`link-wa-${d.id}`}><MessageCircle size={20} /></a>
      {ligar && <a className="icon-btn" href={`tel:${tel}`} aria-label={`Ligar para ${d.contato_nome}`} title="Ligar" data-testid={`link-call-${d.id}`}><Phone size={20} /></a>}
    </div>
  );
}

const CURTO: Record<number, string> = { 1: "Amanhã", 3: "3 dias", 7: "1 semana" };
/** Painel de status de uma negociação: tudo em botões. Aparece ao tocar em "Status". */
export function DealPanel({ d, onChanged }: { d: Deal; onChanged: () => void }) {
  const prefs = usePrefs();
  const act = useAction();
  const [obsOpen, setObsOpen] = useState(false);
  const [obs, setObs] = useState(d.observacoes);
  const clearDirty = useDirty(obsOpen && obs !== d.observacoes);
  const closed = isClosedStage(d.etapa);
  const save = (patch: { etapa?: Etapa; proximo_retorno?: string | null; observacoes?: string }) => {
    if (obsOpen && obs !== d.observacoes && patch.observacoes === undefined) {
      if (!window.confirm("A observação ainda não foi salva. Descartá-la e atualizar o atendimento?")) return Promise.resolve(undefined);
      clearDirty(); setObs(d.observacoes); setObsOpen(false);
    }
    return act.run(async () => {
    try {
      return await api.saveDeal(d.id, {
        contato_id: d.contato_id, fazenda_id: d.fazenda_id, etapa: patch.etapa ?? d.etapa,
        observacoes: patch.observacoes ?? d.observacoes,
        proximo_retorno: "proximo_retorno" in patch ? patch.proximo_retorno ?? null : d.proximo_retorno, versao: d.versao,
      });
    } finally { onChanged(); } // em conflito de versão, recarrega o estado atual
    });
  };
  return (
    <div className="stack deal-panel" style={{ gap: 10 }} data-testid={`controls-deal-${d.id}`}>
      <div className="chips cols3" role="group" aria-label="Status da negociação">
        {ETAPAS.map((e) => <button key={e} className={`chip ${d.etapa === e ? "on" : ""}`} disabled={act.busy} aria-pressed={d.etapa === e} onClick={() => { if (d.etapa !== e) void save({ etapa: e }); }} data-testid={`chip-status-${d.id}-${e}`}>{ROTULOS[e]}</button>)}
      </div>
      {!closed && prefs.lembrar && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Lembrar de retornar</span>
          <div className="chips cols4" role="group" aria-label="Lembrar de retornar">
            {[1, 3, 7].map((days) => {
              const v = daysFromNow(days);
              return <button key={days} className={`chip ${toLocal(d.proximo_retorno) === v ? "on" : ""}`} disabled={act.busy} onClick={() => void save({ proximo_retorno: new Date(v).toISOString() })} data-testid={`chip-remind-${d.id}-${days}d`}>{CURTO[days]}</button>;
            })}
            <button className={`chip ${d.proximo_retorno ? "" : "on"}`} disabled={act.busy || !d.proximo_retorno} onClick={() => void save({ proximo_retorno: null })} data-testid={`chip-remind-${d.id}-none`}>Sem</button>
          </div>
        </div>
      )}
      {prefs.observacao && (
        <div>
          <button className="btn ghost sm" onClick={() => {
            if (obsOpen && obs !== d.observacoes && !window.confirm("Descartar a observação não salva?")) return;
            setObs(d.observacoes); clearDirty(); setObsOpen((o) => !o);
          }} aria-expanded={obsOpen} data-testid={`button-obs-${d.id}`}>{obsOpen ? "Fechar observação" : d.observacoes ? "Editar observação" : "Adicionar observação"}</button>
          {obsOpen && (
            <div className="stack" style={{ gap: 6, marginTop: 6 }}>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={4000} style={{ minHeight: 60 }} placeholder="Opcional" aria-label="Observação" data-testid={`input-obs-${d.id}`} />
              <div className="row"><button className="btn sm primary" disabled={act.busy || obs === d.observacoes} onClick={async () => { if (await save({ observacoes: obs })) { clearDirty(); setObsOpen(false); } }} data-testid={`button-save-obs-${d.id}`}>Salvar observação</button></div>
            </div>
          )}
        </div>
      )}
      <ErrorBox error={act.error} />
    </div>
  );
}

