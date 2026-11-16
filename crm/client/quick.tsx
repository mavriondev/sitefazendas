import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, MessageCircle, Phone } from "lucide-react";
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

/** Ações de um retorno: ligar, WhatsApp com mensagem pronta e registrar atendimento. */
export function DealActions({ d, onDone }: { d: Deal; onDone: (d: Deal) => void }) {
  const tel = d.contato_telefone;
  return (
    <div className="row" style={{ marginTop: 8 }}>
      {tel && <a className="btn sm" href={`tel:${tel}`} data-testid={`link-call-${d.id}`}><Phone size={14} />Ligar</a>}
      {tel && <a className="btn sm" href={waLink(tel, waMessage(d.contato_nome, d.fazenda_titulo))} target="_blank" rel="noopener noreferrer" data-testid={`link-wa-${d.id}`}><MessageCircle size={14} />WhatsApp</a>}
      <button className="btn sm primary" onClick={() => onDone(d)} data-testid={`button-done-${d.id}`}><Check size={14} />Feito</button>
    </div>
  );
}

/* ---------- Registrar atendimento ---------- */
const hoje = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export function DoneForm({ deal, onClose, onSaved }: { deal: Deal; onClose: () => void; onSaved: () => void }) {
  const [nota, setNota] = useState("");
  const [etapa, setEtapa] = useState<Etapa>(deal.etapa);
  const [retorno, setRetorno] = useState("");
  const dirty = !!nota.trim() || etapa !== deal.etapa || !!retorno;
  const clearDirty = useDirty(dirty);
  const act = useAction();
  const closed = isClosedStage(etapa);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closed && !retorno) { act.setError(new Error("Escolha quando retornar, ou mude a etapa para Concluída/Não avançou.")); return; }
    // A anotação entra no topo das observações com a data; o histórico guarda cada versão.
    const obs = nota.trim() ? `${hoje()} – ${nota.trim()}${deal.observacoes ? "\n" + deal.observacoes : ""}`.slice(0, 4000) : deal.observacoes;
    const ok = await act.run(() => api.saveDeal(deal.id, {
      contato_id: deal.contato_id, fazenda_id: deal.fazenda_id, etapa, observacoes: obs, versao: deal.versao,
      proximo_retorno: closed || !retorno ? null : new Date(retorno).toISOString(),
    }));
    if (ok) { clearDirty(); onSaved(); }
  };
  const close = () => { if (!act.busy && (!dirty || window.confirm("Descartar este registro?"))) onClose(); };

  return (
    <Modal title="Registrar atendimento" onClose={close}>
      <form className="form" onSubmit={submit}>
        <fieldset className="form form-fields" disabled={act.busy}>
          <div className="small muted">{deal.contato_nome} · {deal.fazenda_titulo}</div>
          <label className="f">O que foi conversado (opcional)
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} placeholder="Ex.: pediu fotos da sede, vai falar com o sócio" style={{ minHeight: 70 }} data-testid="input-done-note" />
          </label>
          <label className="f">Etapa
            <select value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)} data-testid="select-done-stage">
              {ETAPAS.map((s) => <option key={s} value={s}>{ROTULOS[s]}</option>)}
            </select>
          </label>
          {!closed && (
            <div className="f" style={{ display: "grid", gap: 6 }}>
              <span className="small" style={{ fontWeight: 500, color: "hsl(var(--ink-2))" }}>Próximo retorno</span>
              <QuickReturn value={retorno} onChange={setRetorno} />
              <input type="datetime-local" value={retorno} onChange={(e) => setRetorno(e.target.value)} aria-label="Data e hora do próximo retorno" data-testid="input-done-return" />
            </div>
          )}
          <ErrorBox error={act.error} />
          <div className="modal-foot">
            <button type="button" className="btn" onClick={close}>Cancelar</button>
            <button className="btn primary" disabled={act.busy} data-testid="button-save-done">{act.busy ? "Salvando…" : "Salvar"}</button>
          </div>
        </fieldset>
      </form>
    </Modal>
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
