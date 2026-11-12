import { useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api, key, ETAPAS, ROTULOS, type Contact, type Deal, type Etapa } from "./api";
import { ErrorBox, Modal, useAction, useAuth, useDirty, useLoad, digits } from "./ui";

/* ---------- Deal ---------- */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function DealForm({ deal, presetContato, presetFazenda, onClose, onSaved }: {
  deal?: Deal | null; presetContato?: number; presetFazenda?: number; onClose: () => void; onSaved: (d: Deal) => void;
}) {
  const editing = !!deal;
  const opts = useLoad(async () => editing ? null : Promise.all([api.contacts(""), api.farms()]), [editing]);
  const [contato, setContato] = useState(String(deal?.contato_id ?? presetContato ?? ""));
  const [fazenda, setFazenda] = useState(String(deal?.fazenda_id ?? presetFazenda ?? ""));
  const [etapa, setEtapa] = useState<Etapa>(deal?.etapa ?? "novo");
  const [retorno, setRetorno] = useState(toLocal(deal?.proximo_retorno ?? null));
  const [obs, setObs] = useState(deal?.observacoes ?? "");
  const initial = useRef(JSON.stringify([contato, fazenda, etapa, retorno, obs]));
  const dirty = JSON.stringify([contato, fazenda, etapa, retorno, obs]) !== initial.current;
  useDirty(dirty);
  const reqKey = useRef<string | null>(null);
  const act = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && (!contato || !fazenda)) { act.setError(Object.assign(new Error("Escolha o contato e a fazenda."))); return; }
    if (!editing && !reqKey.current) reqKey.current = key();
    const saved = await act.run(() => api.saveDeal(deal?.id ?? null, {
      contato_id: deal?.contato_id ?? Number(contato), fazenda_id: deal?.fazenda_id ?? Number(fazenda), etapa,
      proximo_retorno: retorno ? new Date(retorno).toISOString() : null, observacoes: obs,
      ...(editing ? { versao: deal!.versao } : { request_key: reqKey.current! }),
    }));
    if (saved) { reqKey.current = null; initial.current = JSON.stringify([contato, fazenda, etapa, retorno, obs]); onSaved(saved); }
  };
  const close = () => { if (!dirty || window.confirm("Descartar alterações nesta negociação?")) onClose(); };

  return (
    <Modal title={editing ? "Editar negociação" : "Nova negociação"} onClose={close}>
      <form className="form" onSubmit={submit}>
        {editing ? (
          <div className="small muted">{deal!.contato_nome} · {deal!.fazenda_titulo}</div>
        ) : (
          <>
            <ErrorBox error={opts.error} retry={opts.reload} />
            <label className="f">Contato
              <select value={contato} onChange={(e) => setContato(e.target.value)} required data-testid="select-deal-contact" disabled={!!presetContato}>
                <option value="">{opts.loading ? "Carregando…" : "Selecione"}</option>
                {opts.data?.[0].contatos.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.telefone}</option>)}
              </select>
            </label>
            <label className="f">Fazenda
              <select value={fazenda} onChange={(e) => setFazenda(e.target.value)} required data-testid="select-deal-farm" disabled={!!presetFazenda}>
                <option value="">{opts.loading ? "Carregando…" : "Selecione"}</option>
                {opts.data?.[1].fazendas.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}
              </select>
            </label>
          </>
        )}
        <div className="form-2">
          <label className="f">Etapa
            <select value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)} data-testid="select-deal-stage">
              {ETAPAS.map((s) => <option key={s} value={s}>{ROTULOS[s]}</option>)}
            </select>
          </label>
          <label className="f">Próximo retorno
            <input type="datetime-local" value={retorno} onChange={(e) => setRetorno(e.target.value)} data-testid="input-deal-return" />
          </label>
        </div>
        {retorno && <button type="button" className="btn ghost sm" style={{ justifySelf: "start" }} onClick={() => setRetorno("")} data-testid="button-clear-return">Limpar retorno</button>}
        <label className="f">Observações
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={4000} data-testid="input-deal-notes" />
        </label>
        <ErrorBox error={act.error} />
        <div className="modal-foot">
          <button type="button" className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" disabled={act.busy} data-testid="button-save-deal">{act.busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Contact ---------- */
export function ContactForm({ contact, onClose, onSaved }: { contact?: Contact | null; onClose: () => void; onSaved: (c: Contact) => void }) {
  const { user } = useAuth();
  const isAdmin = user.papel === "admin";
  const opts = useLoad(() => Promise.all([api.farms(), isAdmin ? api.users() : Promise.resolve({ usuarios: [] })]), [isAdmin]);
  const start = {
    nome: contact?.nome ?? "", telefone: contact?.telefone ?? "", email: contact?.email ?? "", origem: contact?.origem ?? "Contato manual",
    observacoes: contact?.observacoes ?? "", responsavel_id: contact?.responsavel_id ?? user.id, fazenda_ids: contact?.fazenda_ids ?? [],
  };
  const [v, setV] = useState(start);
  const initial = useRef(JSON.stringify(start));
  const dirty = JSON.stringify(v) !== initial.current;
  useDirty(dirty);
  const [dups, setDups] = useState<Array<{ id: number; nome: string }>>([]);
  const [confirmDup, setConfirmDup] = useState(false);
  const [farmQ, setFarmQ] = useState("");
  const reqKey = useRef<string | null>(null);
  const act = useAction();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  const checkDup = async () => {
    if (digits(v.telefone).length < 8) { setDups([]); return; }
    try { const r = await api.duplicates(v.telefone, contact?.id); setDups(r.contatos); if (!r.contatos.length) setConfirmDup(false); }
    catch (e) { act.setError(e as Error); }
  };
  const farms = useMemo(() => {
    const list = opts.data?.[0].fazendas ?? [];
    const q = farmQ.trim().toLowerCase();
    return q ? list.filter((f) => f.titulo.toLowerCase().includes(q) || (f.regiao ?? "").toLowerCase().includes(q)) : list;
  }, [opts.data, farmQ]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact && !reqKey.current) reqKey.current = key();
    const saved = await act.run(() => api.saveContact(contact?.id ?? null, {
      nome: v.nome.trim(), telefone: v.telefone.trim(), email: v.email.trim() || null, origem: v.origem.trim(), observacoes: v.observacoes,
      responsavel_id: Number(v.responsavel_id), fazenda_ids: v.fazenda_ids.map(Number),
      ...(contact ? { versao: contact.versao } : { request_key: reqKey.current! }),
      ...(confirmDup ? { confirmar_duplicado: true } : {}),
    }));
    if (saved) { reqKey.current = null; initial.current = JSON.stringify(v); onSaved(saved); }
  };
  const err = act.error;
  // 409 de telefone traz a propriedade duplicates (mesmo vazia); 409 sem ela é conflito de versão.
  const conflict = err?.status === 409 && Array.isArray(err.duplicates) ? err.duplicates : null;
  const shownDups = conflict ?? dups;
  const showDupBox = conflict !== null || dups.length > 0;
  const close = () => { if (!dirty || window.confirm("Descartar alterações neste contato?")) onClose(); };

  return (
    <Modal title={contact ? "Editar contato" : "Novo contato"} onClose={close}>
      <form className="form" onSubmit={submit}>
        <label className="f">Nome<input value={v.nome} onChange={(e) => set("nome", e.target.value)} required maxLength={150} data-testid="input-contact-name" /></label>
        <div className="form-2">
          <label className="f">Telefone<input type="tel" inputMode="tel" value={v.telefone} onChange={(e) => { set("telefone", e.target.value); setConfirmDup(false); }} onBlur={checkDup} required maxLength={40} data-testid="input-contact-phone" /></label>
          <label className="f">E-mail (opcional)<input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} maxLength={200} data-testid="input-contact-email" /></label>
        </div>
        {showDupBox && (
          <div className="alert warn" data-testid="status-duplicates">
            <AlertTriangle size={17} />
            <div style={{ display: "grid", gap: 6 }}>
              <div>{shownDups.length > 0 ? `Este telefone já está em: ${shownDups.map((d) => d.nome).join(", ")}.` : "Este telefone já pertence a outro cadastro da equipe."} Nada será mesclado automaticamente.</div>
              <label className="row" style={{ fontWeight: 500 }}>
                <input type="checkbox" checked={confirmDup} onChange={(e) => setConfirmDup(e.target.checked)} data-testid="checkbox-confirm-duplicate" />
                Salvar mesmo assim como contato separado
              </label>
            </div>
          </div>
        )}
        <div className="form-2">
          <label className="f">Origem<input value={v.origem} onChange={(e) => set("origem", e.target.value)} placeholder="Indicação, site, ligação…" required maxLength={100} data-testid="input-contact-origin" /></label>
          <label className="f">Responsável
            {isAdmin ? (
              <select value={v.responsavel_id} onChange={(e) => set("responsavel_id", Number(e.target.value))} data-testid="select-contact-owner">
                {!opts.data && <option value={v.responsavel_id}>{contact?.responsavel_nome ?? user.nome}</option>}
                {opts.data?.[1].usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.bloqueado ? " (bloqueado)" : ""}</option>)}
              </select>
            ) : <input value={contact?.responsavel_nome ?? user.nome} disabled />}
          </label>
        </div>
        <label className="f">Observações<textarea value={v.observacoes} onChange={(e) => set("observacoes", e.target.value)} maxLength={4000} data-testid="input-contact-notes" /></label>
        <div className="f" style={{ display: "grid", gap: 6 }}>
          <span className="small" style={{ fontWeight: 500, color: "hsl(var(--ink-2))" }}>Fazendas de interesse ({v.fazenda_ids.length})</span>
          <input placeholder="Filtrar fazendas" value={farmQ} onChange={(e) => setFarmQ(e.target.value)} data-testid="input-filter-farms" />
          <ErrorBox error={opts.error} retry={opts.reload} />
          <div className="check-list">
            {opts.loading && !opts.data ? <div className="skel" style={{ height: 80 }} /> : farms.length === 0 ? <div className="small muted" style={{ padding: 8 }}>Nenhuma fazenda disponível.</div> :
              farms.map((f) => (
                <label key={f.id}>
                  <input type="checkbox" checked={v.fazenda_ids.includes(f.id)} data-testid={`checkbox-farm-${f.id}`}
                    onChange={(e) => set("fazenda_ids", e.target.checked ? [...v.fazenda_ids, f.id] : v.fazenda_ids.filter((x) => x !== f.id))} />
                  <span>{f.titulo}{f.regiao ? <span className="muted"> · {f.regiao}</span> : null}</span>
                </label>
              ))}
          </div>
        </div>
        <ErrorBox error={conflict ? null : err} />
        <div className="modal-foot">
          <button type="button" className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" disabled={act.busy || (conflict !== null && !confirmDup)} data-testid="button-save-contact">{act.busy ? "Salvando…" : "Salvar contato"}</button>
        </div>
      </form>
    </Modal>
  );
}
