import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api, key, type Contact } from "./api";
import { QuickReturn } from "./quick";
import { ErrorBox, Modal, fmtPhone, useAction, useAuth, useDirty, useLoad } from "./ui";

type Props = {
  onClose: () => void;
  onSaved: (contact: Contact) => void;
  presetContato?: Contact;
  presetFazenda?: number;
};
type Attempt = {
  contact: Contact | null; name: string; phone: string; origin: string;
  farm: number | null; returnAt: string | null; notes: string;
};

/** O reenvio usa o mesmo conteúdo e as mesmas chaves, mesmo após perda de conexão. */
export function QuickContactForm({ onClose, onSaved, presetContato, presetFazenda }: Props) {
  const { user } = useAuth();
  const farms = useLoad(() => api.farms(), []);
  const contacts = useLoad(() => api.contacts(), []);
  const [existing, setExisting] = useState(!!presetContato);
  const [selected, setSelected] = useState<Contact | null>(presetContato ?? null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [origin, setOrigin] = useState("WhatsApp");
  const [farm, setFarm] = useState(presetFazenda ? String(presetFazenda) : "");
  const [returnAt, setReturnAt] = useState("");
  const [notes, setNotes] = useState("");
  const [locked, setLocked] = useState(false);
  const attempt = useRef<Attempt | null>(null);
  const contactKey = useRef(key());
  const dealKey = useRef(key());
  const act = useAction();
  const dirty = !!(name.trim() || phone.trim() || notes.trim() || returnAt || origin !== "WhatsApp" ||
    selected && !presetContato || farm !== (presetFazenda ? String(presetFazenda) : ""));
  const clearDirty = useDirty(dirty || locked);
  const list = (farms.data?.fazendas ?? []).filter(f => f.disponivel);
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const matches = (contacts.data?.contatos ?? []).filter(c =>
    !term || c.nome.toLocaleLowerCase("pt-BR").includes(term) ||
    c.telefone.replace(/\D/g, "").includes(term.replace(/\D/g, "") || "!"));
  const duplicates = act.error?.status === 409 && Array.isArray(act.error.duplicates) ? act.error.duplicates : null;

  const close = () => {
    if (act.busy) return;
    if ((dirty || locked) && !window.confirm(locked
      ? "O envio não foi concluído. Fechar? Um contato já salvo será mantido; confira a ficha antes de iniciar outro atendimento."
      : "Descartar este atendimento?")) return;
    clearDirty();
    onClose();
  };
  const useExisting = async (id: number) => {
    const result = await act.run(() => api.contact(id));
    if (result) {
      setSelected(result.contato);
      setExisting(true);
      act.setError(null);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attempt.current) {
      if (existing && !selected) { act.setError(new Error("Selecione um contato.")); return; }
      if (!farm) { act.setError(new Error("Escolha a fazenda deste atendimento.")); return; }
      const date = farm && returnAt ? new Date(returnAt) : null;
      if (date && Number.isNaN(date.getTime())) { act.setError(new Error("Informe uma data válida.")); return; }
      attempt.current = {
        contact: existing ? selected : null, name: name.trim(), phone: phone.trim(), origin,
        farm: farm ? Number(farm) : null, returnAt: date?.toISOString() ?? null, notes: notes.trim(),
      };
    }
    const a = attempt.current;
    setLocked(true);
    const result = await act.run(async () => {
      a.contact ??= await api.saveContact(null, {
        nome: a.name, telefone: a.phone, email: null, origem: a.origin,
        observacoes: a.farm ? "" : a.notes, responsavel_id: user.id,
        fazenda_ids: a.farm ? [a.farm] : [], request_key: contactKey.current,
      });
      if (a.farm) await api.saveDeal(null, {
        contato_id: a.contact.id, fazenda_id: a.farm, etapa: "novo",
        observacoes: a.notes, proximo_retorno: a.returnAt, request_key: dealKey.current,
      });
      return a.contact;
    });
    if (result) { clearDirty(); onSaved(result); }
  };
  const editableValidation = locked &&
    [400, 403, 404, 409, 422, 429].includes(act.error?.status ?? 0);
  const edit = () => {
    // Se apenas a segunda etapa falhou, nunca cadastrar a pessoa novamente.
    if (attempt.current?.contact) { setSelected(attempt.current.contact); setExisting(true); }
    attempt.current = null; setLocked(false); act.setError(null);
  };

  return (
    <Modal title="Novo atendimento" onClose={close}>
      <form className="form" onSubmit={submit}>
        <fieldset className="form form-fields" disabled={act.busy || locked}>
          {!presetContato && <div className="chips" role="group" aria-label="Tipo de contato">
            <button type="button" className={`chip ${!existing ? "on" : ""}`} aria-pressed={!existing} onClick={() => { setExisting(false); setSelected(null); act.setError(null); }} data-testid="button-contact-new">Novo contato</button>
            <button type="button" className={`chip ${existing ? "on" : ""}`} aria-pressed={existing} onClick={() => { setExisting(true); act.setError(null); }} data-testid="button-contact-existing">Já cadastrado</button>
          </div>}
          {existing ? (
            <div className="stack" style={{ gap: 8 }}>
              {selected ? <div className="alert" data-testid="selected-existing-contact">
                <div><strong>{selected.nome}</strong><div className="small">{fmtPhone(selected.telefone)}</div></div>
                {!presetContato && <button type="button" className="btn sm" onClick={() => setSelected(null)}>Trocar</button>}
              </div> : <>
                <label className="f">Buscar contato<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou telefone" data-testid="input-existing-search" /></label>
                <div className="list" style={{ maxHeight: 200, overflowY: "auto" }}>
                  {matches.map(c => <button className="item" type="button" key={c.id} onClick={() => setSelected(c)} data-testid={`select-existing-${c.id}`}><span className="item-main"><strong>{c.nome}</strong><span className="item-sub">{fmtPhone(c.telefone)}</span></span></button>)}
                </div>
                {!matches.length && !contacts.loading && !contacts.error && <p className="small muted">Nenhum contato encontrado.</p>}
                {contacts.loading && <p className="small muted" role="status">Carregando contatos…</p>}
                <ErrorBox error={contacts.error} retry={contacts.reload} />
              </>}
            </div>
          ) : <div className="form-2">
            <label className="f">Nome<input value={name} onChange={e => setName(e.target.value)} required maxLength={150} autoFocus data-testid="input-quick-name" /></label>
            <label className="f">Telefone com DDD<input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={40} data-testid="input-quick-phone" /></label>
          </div>}
          <label className="f">Fazenda de interesse
            <select value={farm} onChange={e => setFarm(e.target.value)} required data-testid="select-quick-farm">
              <option value="">{farms.loading ? "Carregando…" : "Selecione uma fazenda"}</option>
              {list.map(f => <option key={f.id} value={f.id}>{f.titulo}</option>)}
            </select>
          </label>
          {!farms.loading && !farms.error && !list.length && <p className="small muted">Nenhuma fazenda disponível para atendimento. Para cadastrar somente uma pessoa, use Cadastro completo em Contatos.</p>}
          <ErrorBox error={farms.error} retry={farms.reload} />
          {farm && <div className="f">
            <span>Próximo retorno (opcional)</span>
            <QuickReturn value={returnAt} onChange={setReturnAt} />
            <input type="datetime-local" value={returnAt} onChange={e => setReturnAt(e.target.value)} aria-label="Data e hora do retorno" data-testid="input-quick-return" />
            {returnAt && <button type="button" className="btn sm ghost" onClick={() => setReturnAt("")}>Sem data por enquanto</button>}
          </div>}
          <details>
            <summary>Mais detalhes (opcional)</summary>
            <div className="stack" style={{ gap: 12, marginTop: 12 }}>
              {!existing && <label className="f">Como chegou<select value={origin} onChange={e => setOrigin(e.target.value)} data-testid="select-quick-origin">{["WhatsApp", "Ligação", "Site", "Indicação", "Outro"].map(o => <option key={o}>{o}</option>)}</select></label>}
              <label className="f">Observação<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000} data-testid="input-quick-notes" /></label>
            </div>
          </details>
        </fieldset>
        {duplicates && <div className="alert warn" data-testid="status-quick-duplicates"><AlertTriangle size={17} /><div className="stack" style={{ gap: 8 }}>
          <span>Este telefone já está cadastrado. Use o contato existente para não duplicar.</span>
          {duplicates.map(c => <button key={c.id} type="button" className="btn" disabled={act.busy} onClick={async () => { edit(); await useExisting(c.id); }} data-testid={`button-use-duplicate-${c.id}`}>Usar {c.nome}</button>)}
          {!duplicates.length && <span>Peça ao administrador acesso ao cadastro existente.</span>}
        </div></div>}
        {locked && act.error && !editableValidation && <div className="alert warn" role="status">Não foi possível concluir o envio. Tente novamente com os mesmos dados; os registros já recebidos não serão duplicados.</div>}
        <ErrorBox error={duplicates ? null : act.error} />
        <div className="modal-foot">
          <button type="button" className="btn" disabled={act.busy} onClick={close}>Cancelar</button>
          {editableValidation ? <button type="button" className="btn primary" onClick={edit}>Corrigir dados</button> :
            <button className="btn primary" disabled={act.busy || existing && !selected || !farm} data-testid="button-save-quick">{act.busy ? "Salvando…" : locked ? "Tentar novamente" : "Salvar atendimento"}</button>}
        </div>
      </form>
    </Modal>
  );
}
