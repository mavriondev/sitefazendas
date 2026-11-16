import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, MessageCircle, Phone } from "lucide-react";
import { api, key, ETAPAS, ROTULOS, type Contact, type Deal, type Etapa } from "./api";
import { isClosedStage } from "../shared";
import { ErrorBox, Modal, useAction, useAuth, useDirty, useLoad, waLink } from "./ui";

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

/** Controles de uma negociação: tudo em botões. A conversa acontece no WhatsApp; o CRM só marca o status. */
export function DealControls({ d, onChanged }: { d: Deal; onChanged: () => void }) {
  const act = useAction();
  const [obsOpen, setObsOpen] = useState(false);
  const [obs, setObs] = useState(d.observacoes);
  const tel = d.contato_telefone;
  const closed = isClosedStage(d.etapa);
  const save = (patch: { etapa?: Etapa; proximo_retorno?: string | null; observacoes?: string }) => act.run(async () => {
    try {
      await api.saveDeal(d.id, {
        contato_id: d.contato_id, fazenda_id: d.fazenda_id, etapa: patch.etapa ?? d.etapa,
        observacoes: patch.observacoes ?? d.observacoes,
        proximo_retorno: "proximo_retorno" in patch ? patch.proximo_retorno ?? null : d.proximo_retorno, versao: d.versao,
      });
    } finally { onChanged(); } // em conflito de versão, recarrega o estado atual
  });
  return (
    <div className="stack" style={{ gap: 8, marginTop: 8 }} data-testid={`controls-deal-${d.id}`}>
      <div className="row">
        {tel && <a className="btn sm" href={waLink(tel, waMessage(d.contato_nome, d.fazenda_titulo))} target="_blank" rel="noopener noreferrer" data-testid={`link-wa-${d.id}`}><MessageCircle size={14} />WhatsApp</a>}
        {tel && <a className="btn sm" href={`tel:${tel}`} data-testid={`link-call-${d.id}`}><Phone size={14} />Ligar</a>}
      </div>
      <div className="chips cols" role="group" aria-label="Status da negociação">
        {ETAPAS.map((e) => <button key={e} className={`chip ${d.etapa === e ? "on" : ""}`} disabled={act.busy} aria-pressed={d.etapa === e} onClick={() => { if (d.etapa !== e) void save({ etapa: e }); }} data-testid={`chip-status-${d.id}-${e}`}>{ROTULOS[e]}</button>)}
      </div>
      {!closed && (
        <div className="chips cols" role="group" aria-label="Lembrar de retornar">
          <span className="small muted chip-label" style={{ alignSelf: "center" }}>Lembrar de retornar:</span>
          {ATALHOS.slice(0, 3).map((a) => {
            const v = daysFromNow(a.days);
            return <button key={a.days} className={`chip ${toLocal(d.proximo_retorno) === v ? "on" : ""}`} disabled={act.busy} onClick={() => void save({ proximo_retorno: new Date(v).toISOString() })} data-testid={`chip-remind-${d.id}-${a.days}d`}>{a.label}</button>;
          })}
          {d.proximo_retorno && <button className="chip" disabled={act.busy} onClick={() => void save({ proximo_retorno: null })} data-testid={`chip-remind-${d.id}-none`}>Sem lembrete</button>}
        </div>
      )}
      <div>
        <button className="btn ghost sm" onClick={() => setObsOpen((o) => !o)} aria-expanded={obsOpen} data-testid={`button-obs-${d.id}`}>{obsOpen ? "Fechar observação" : d.observacoes ? "Editar observação" : "Adicionar observação"}</button>
        {obsOpen && (
          <div className="stack" style={{ gap: 6, marginTop: 6 }}>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={4000} style={{ minHeight: 60 }} placeholder="Opcional" aria-label="Observação" data-testid={`input-obs-${d.id}`} />
            <div className="row"><button className="btn sm primary" disabled={act.busy || obs === d.observacoes} onClick={async () => { await save({ observacoes: obs }); setObsOpen(false); }} data-testid={`button-save-obs-${d.id}`}>Salvar observação</button></div>
          </div>
        )}
      </div>
      <ErrorBox error={act.error} />
    </div>
  );
}

/* ---------- Cadastro rápido ---------- */
const ORIGENS = ["Ligação", "WhatsApp", "Site", "Indicação", "Outro"];
export function QuickContactForm({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Contact) => void }) {
  const { user } = useAuth();
  const farms = useLoad(() => api.farms(), []);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [origem, setOrigem] = useState("Ligação");
  const [fazenda, setFazenda] = useState("");
  const [retorno, setRetorno] = useState(daysFromNow(1));
  const [obs, setObs] = useState("");
  const [confirmDup, setConfirmDup] = useState(false);
  const [saved, setSaved] = useState<Contact | null>(null);
  const contactKey = useRef(key());
  const dealKey = useRef(key());
  const dirty = !!(nome.trim() || telefone.trim() || obs.trim() || fazenda);
  const clearDirty = useDirty(dirty && !saved);
  const act = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fid = fazenda ? Number(fazenda) : null;
    const result = await act.run(async () => {
      // As chaves de requisição tornam o reenvio seguro: não duplica contato nem negociação.
      const c = saved ?? await api.saveContact(null, {
        nome: nome.trim(), telefone: telefone.trim(), email: null, origem, observacoes: fid ? "" : obs,
        responsavel_id: user.id, fazenda_ids: fid ? [fid] : [], request_key: contactKey.current, ...(confirmDup ? { confirmar_duplicado: true } : {}),
      });
      setSaved(c);
      if (fid) await api.saveDeal(null, {
        contato_id: c.id, fazenda_id: fid, etapa: "novo", observacoes: obs,
        proximo_retorno: retorno ? new Date(retorno).toISOString() : null, request_key: dealKey.current,
      });
      return c;
    });
    if (result) { clearDirty(); onSaved(result); }
  };
  const close = () => { if (!act.busy && (saved || !dirty || window.confirm("Descartar este cadastro?"))) { if (saved) onSaved(saved); else onClose(); } };
  const err = act.error;
  const dups = err?.status === 409 && Array.isArray(err.duplicates) ? err.duplicates : null;
  const lista = (farms.data?.fazendas ?? []).filter((f) => f.disponivel);

  return (
    <Modal title="Novo contato" onClose={close}>
      <form className="form" onSubmit={submit}>
        <fieldset className="form form-fields" disabled={act.busy}>
          <fieldset className="form form-fields" disabled={!!saved} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="form-2">
              <label className="f">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={150} autoFocus data-testid="input-quick-name" /></label>
              <label className="f">Telefone com DDD<input type="tel" inputMode="tel" value={telefone} onChange={(e) => { setTelefone(e.target.value); setConfirmDup(false); if (dups) act.setError(null); }} required maxLength={40} data-testid="input-quick-phone" /></label>
            </div>
            <div className="f" style={{ display: "grid", gap: 6 }}>
              <span className="small" style={{ fontWeight: 500, color: "hsl(var(--ink-2))" }}>Como chegou</span>
              <div className="chips" role="group" aria-label="Origem">
                {ORIGENS.map((o) => <button type="button" key={o} className={`chip ${origem === o ? "on" : ""}`} onClick={() => setOrigem(o)} data-testid={`chip-origin-${o}`}>{o}</button>)}
              </div>
            </div>
          </fieldset>
          {dups && (
            <div className="alert warn" data-testid="status-quick-duplicates">
              <AlertTriangle size={17} />
              <div style={{ display: "grid", gap: 6 }}>
                <div>{dups.length ? <>Este telefone já está em: {dups.map((d, i) => <span key={d.id}>{i > 0 && ", "}<Link to={`/contatos/${d.id}`}>{d.nome}</Link></span>)}.</> : "Este telefone já pertence a outro cadastro da equipe."}</div>
                <label className="row" style={{ fontWeight: 500 }}>
                  <input type="checkbox" checked={confirmDup} onChange={(e) => setConfirmDup(e.target.checked)} data-testid="checkbox-quick-duplicate" />
                  Cadastrar mesmo assim como contato separado
                </label>
              </div>
            </div>
          )}
          <label className="f">Fazenda de interesse (opcional)
            <select value={fazenda} onChange={(e) => setFazenda(e.target.value)} data-testid="select-quick-farm">
              <option value="">{farms.loading && !farms.data ? "Carregando…" : "Nenhuma por enquanto"}</option>
              {lista.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}
            </select>
          </label>
          <ErrorBox error={farms.error} retry={farms.reload} />
          {fazenda && (
            <div className="f" style={{ display: "grid", gap: 6 }}>
              <span className="small" style={{ fontWeight: 500, color: "hsl(var(--ink-2))" }}>Quando retornar</span>
              <QuickReturn value={retorno} onChange={setRetorno} />
              <input type="datetime-local" value={retorno} onChange={(e) => setRetorno(e.target.value)} aria-label="Data e hora do retorno" data-testid="input-quick-return" />
            </div>
          )}
          <label className="f">Observação (opcional)<textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={4000} style={{ minHeight: 60 }} data-testid="input-quick-notes" /></label>
          {saved && err && <div className="alert warn"><AlertTriangle size={17} /><div>O contato foi salvo, mas a negociação não. Tente salvar de novo ou <Link to={`/contatos/${saved.id}`}>abra o contato</Link>.</div></div>}
          <ErrorBox error={dups ? null : err} />
          <div className="modal-foot">
            <button type="button" className="btn" onClick={close}>Cancelar</button>
            <button className="btn primary" disabled={act.busy || (dups !== null && !confirmDup)} data-testid="button-save-quick">{act.busy ? "Salvando…" : "Salvar"}</button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
