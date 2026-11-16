import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Link2, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { Aviso, Ok } from "../components/Avisos";
import { CardsFazenda, ICONES_CARD } from "../components/CardsFazenda";
import { ICONES_CARDS, LIMITE_CARDS, ORIGENS_CARDS, resolverCards, type BaseCardsPublica, type CardFazenda, type CardPublico, type IconeCard } from "../../../shared/cards";
import { useConfirmar, useFormularioComRascunho } from "./comuns";
import "./CardsAdmin.css";

type Confirmar = ReturnType<typeof useConfirmar>[0];
type Acao = (fn: () => Promise<unknown>, msg?: string) => Promise<void>;

const SUGESTOES: Array<{ titulo: string; icone: IconeCard; tema: string }> = [
  { titulo: "Água", icone: "agua", tema: "água" },
  { titulo: "Solo e relevo", icone: "solo", tema: "solo e relevo" },
  { titulo: "Estrutura", icone: "estrutura", tema: "estrutura" },
  { titulo: "Acesso e logística", icone: "acesso", tema: "acesso e logística" },
  { titulo: "Vocação", icone: "vocacao", tema: "vocação" },
];
const novoId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const proibido = /[<>\u0000-\u001f\u007f]/;
const pareceMedida = /\d[\d.,\s]*\s*(ha\b|hectares?|alqueires?|m²|m2\b|km²|tarefas?)/i;
const rotuloOrigem = (k: string) => ORIGENS_CARDS.find((o) => o.chave === k)?.rotulo ?? k;

function normalizar(cs: CardFazenda[]): CardFazenda[] {
  return cs.map((c) => c.tipo === "editorial"
    ? { id: c.id, titulo: c.titulo.trim(), complemento: c.complemento.trim(), icone: c.icone, visivel: c.visivel, tipo: "editorial", informacao: c.informacao.trim() }
    : { id: c.id, titulo: c.titulo.trim(), complemento: c.complemento.trim(), icone: c.icone, visivel: c.visivel, tipo: "vinculado", origem: c.origem });
}
function problemas(c: CardFazenda): string[] {
  const p: string[] = [];
  if (!c.titulo.trim()) p.push("Informe o título.");
  if (c.titulo.length > 80) p.push("Título com até 80 caracteres.");
  if (c.tipo === "editorial") {
    if (!c.informacao.trim()) p.push("Escreva a informação principal (obrigatória mesmo com o card oculto).");
    if (c.informacao.length > 320) p.push("Informação principal com até 320 caracteres.");
  } else if (!ORIGENS_CARDS.some((o) => o.chave === c.origem)) p.push("Escolha uma origem pública válida.");
  if (c.complemento.length > 240) p.push("Complemento com até 240 caracteres.");
  if ([c.titulo, c.complemento, c.tipo === "editorial" ? c.informacao : ""].some((s) => proibido.test(s))) p.push("Use texto simples, sem quebras de linha nem os sinais < e >.");
  return p;
}

export function CardsAdmin({ id, config, base, previaSalva, acao, confirmar }: { id: string; config: CardFazenda[]; base: BaseCardsPublica; previaSalva: CardPublico[]; acao: Acao; confirmar: Confirmar }) {
  // JSONB pode devolver chaves em outra ordem. Compare sempre a mesma forma,
  // para não manter "alterações não salvas" depois de uma gravação bem-sucedida.
  const { v, setV, sujo, recuperado, descartar } = useFormularioComRascunho<CardFazenda[]>(`rascunho-cards-${id}`, normalizar(config));
  const [salvoAgora, setSalvoAgora] = useState(false);
  const previa = useMemo(() => sujo ? resolverCards(v, base) : previaSalva, [v, base, sujo, previaSalva]);
  const erros = useMemo(() => Object.fromEntries(v.map((c) => [c.id, problemas(c)])), [v]);
  const totalErros = Object.values(erros).filter((e) => e.length).length;
  const cheio = v.length >= LIMITE_CARDS;

  const mudar = (cid: string, patch: Partial<CardFazenda> | ((c: CardFazenda) => CardFazenda)) => {
    setSalvoAgora(false);
    setV(v.map((c) => (c.id === cid ? (typeof patch === "function" ? patch(c) : ({ ...c, ...patch } as CardFazenda)) : c)));
  };
  const mover = (i: number, d: -1 | 1, alvo: "sobe" | "desce") => {
    const j = i + d; if (j < 0 || j >= v.length) return;
    const n = [...v]; [n[i], n[j]] = [n[j], n[i]]; setV(n); setSalvoAgora(false);
    const cid = v[i].id;
    requestAnimationFrame(() => {
      const b = document.getElementById(`card-${cid}-${alvo}`) as HTMLButtonElement | null;
      (b && !b.disabled ? b : document.getElementById(`card-${cid}-${alvo === "sobe" ? "desce" : "sobe"}`))?.focus();
    });
  };
  const adicionar = (c: Omit<CardFazenda, "id">) => {
    if (cheio) return;
    const nid = novoId(); setV([...v, { ...c, id: nid } as CardFazenda]); setSalvoAgora(false);
    requestAnimationFrame(() => document.getElementById(`card-${nid}-titulo`)?.focus());
  };
  const remover = async (c: CardFazenda) => {
    if (!(await confirmar({ titulo: `Remover o card “${c.titulo.trim() || "sem título"}”?`, texto: "Ele sai desta lista agora e do site quando você salvar. Para só tirar do site, use “Oculto”.", confirmar: "Remover card", perigo: true }))) return;
    setV(v.filter((x) => x.id !== c.id)); setSalvoAgora(false);
  };
  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalErros) return;
    const cards = normalizar(v);
    // acao engole erros: só limpamos o rascunho (setV com a versão salva) depois que a API respondeu ok.
    void acao(async () => { await api.put(`/api/admin/fazendas/${id}/cards`, { cards }); setV(cards); setSalvoAgora(true); }, "Cards salvos.");
  };
  const temasUsados = new Set(v.map((c) => c.titulo.trim().toLowerCase()));

  return (
    <div className="cda">
      <div className="painel cda-intro">
        <h3>Cards da fazenda</h3>
        <p className="suave pequeno">Aparecem logo abaixo das fotos. Cada card é <strong>vinculado</strong> a um dado já publicado (área, região, culturas ou um item de Dados da terra marcado “Mostrar no site”), ou é um <strong>texto do corretor</strong> escrito aqui para publicação. Prefira vincular: o valor técnico continua sendo editado na origem (Dados ou Dados da terra) e o card nunca fica desatualizado. Sem nenhum card visível, a faixa não aparece no site.</p>
        <p className="suave pequeno">Medidas de área em texto livre são recusadas ao salvar. Para mostrar a área, use um card vinculado a “Área pública”: ela sai com a formatação e a autorização definidas em Dados da terra.</p>
      </div>

      <form onSubmit={salvar} className="cda-form" noValidate>
        {recuperado && sujo && <Aviso>Recuperamos cards que você editou e ainda não tinha salvo. Revise e salve, ou <button type="button" className="link-acao" onClick={descartar}>descarte as alterações</button>.</Aviso>}
        {salvoAgora && !sujo && <Ok>Cards salvos. Aparecem no site se o anúncio estiver publicado e as origens estiverem públicas.</Ok>}

        {v.length === 0 ? (
          <div className="painel cda-vazio">
            <strong>Nenhum card configurado.</strong>
            <p className="suave pequeno">Com a lista vazia e salva, o site não mostra a faixa de cards nesta fazenda. Adicione um card vinculado ou use um dos temas sugeridos abaixo.</p>
          </div>
        ) : (
          <ol className="cda-lista">
            {v.map((c, i) => {
              const Icone = ICONES_CARD[c.icone];
              const p = erros[c.id] ?? [];
              const aparece = resolverCards([c], base).length > 0;
              const semOrigem = c.tipo === "vinculado" && c.visivel && resolverCards([{ ...c, titulo: c.titulo.trim() || "x" }], base).length === 0;
              const medida = c.tipo === "editorial" && (pareceMedida.test(c.informacao) || pareceMedida.test(c.complemento));
              return (
                <li key={c.id} className={`cda-card ${c.visivel ? "" : "oculto"}`} data-testid={`editor-card-${c.id}`}>
                  <div className="cda-topo">
                    <span className="cda-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    <span className="cda-ico"><Icone aria-hidden="true" /></span>
                    <strong className="cda-nome">{c.titulo.trim() || "Sem título"}</strong>
                    <span className={`cda-estado ${aparece ? "sim" : "nao"}`}>{!c.visivel ? "Oculto" : aparece ? "Aparece no site" : "Não aparece"}</span>
                    <div className="cda-acoes">
                      <button type="button" className="btn mini sec" onClick={() => { mudar(c.id, { visivel: !c.visivel }); }} aria-pressed={!c.visivel} title={c.visivel ? "Ocultar do site" : "Mostrar no site"}>{c.visivel ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}<span>{c.visivel ? "Ocultar" : "Mostrar"}</span></button>
                      <button type="button" id={`card-${c.id}-sobe`} className="btn mini sec" disabled={i === 0} onClick={() => mover(i, -1, "sobe")} aria-label={`Mover “${c.titulo || "card"}” para cima`}><ArrowUp aria-hidden="true" /></button>
                      <button type="button" id={`card-${c.id}-desce`} className="btn mini sec" disabled={i === v.length - 1} onClick={() => mover(i, 1, "desce")} aria-label={`Mover “${c.titulo || "card"}” para baixo`}><ArrowDown aria-hidden="true" /></button>
                      <button type="button" className="btn mini perigo" onClick={() => void remover(c)} aria-label={`Remover “${c.titulo || "card"}”`}><Trash2 aria-hidden="true" /></button>
                    </div>
                  </div>

                  <div className="cda-campos">
                    <div className="cda-largo">
                      <label htmlFor={`card-${c.id}-titulo`}>Título <span className="cda-cont">{c.titulo.length}/80</span></label>
                      <input id={`card-${c.id}-titulo`} maxLength={80} value={c.titulo} onChange={(e) => mudar(c.id, { titulo: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor={`card-${c.id}-icone`}>Ícone</label>
                      <select id={`card-${c.id}-icone`} value={c.icone} onChange={(e) => mudar(c.id, { icone: e.target.value as IconeCard })}>
                        {Object.entries(ICONES_CARDS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                      </select>
                    </div>
                    <fieldset className="cda-tipo cda-cheio">
                      <legend>Informação principal</legend>
                      <div className="cda-seg" role="radiogroup">
                        {(["vinculado", "editorial"] as const).map((t) => (
                          <label key={t} className={c.tipo === t ? "ativo" : ""}>
                            <input type="radio" name={`tipo-${c.id}`} checked={c.tipo === t} onChange={() => mudar(c.id, (x) => t === "editorial"
                              ? { id: x.id, titulo: x.titulo, complemento: x.complemento, icone: x.icone, visivel: x.visivel, tipo: "editorial", informacao: "" }
                              : { id: x.id, titulo: x.titulo, complemento: x.complemento, icone: x.icone, visivel: x.visivel, tipo: "vinculado", origem: "regiao" })} />
                            {t === "vinculado" ? <><Link2 aria-hidden="true" />Dado publicado</> : "Texto do corretor"}
                          </label>
                        ))}
                      </div>
                      {c.tipo === "vinculado" ? (
                        <>
                          <label htmlFor={`card-${c.id}-origem`}>Origem pública</label>
                          <select id={`card-${c.id}-origem`} value={c.origem} onChange={(e) => mudar(c.id, { origem: e.target.value } as Partial<CardFazenda>)}>
                            {!ORIGENS_CARDS.some((o) => o.chave === c.origem) && <option value={c.origem}>Origem indisponível</option>}
                            {ORIGENS_CARDS.map((o) => <option key={o.chave} value={o.chave}>{o.rotulo}</option>)}
                          </select>
                          {semOrigem && <p className="cda-nota">“{rotuloOrigem(c.origem)}” não tem valor publicado agora, então este card não aparece no site. Preencha e ative “Mostrar no site” na origem (Dados ou Dados da terra).</p>}
                        </>
                      ) : (
                        <>
                          <label htmlFor={`card-${c.id}-info`}>Texto para publicação <span className="cda-cont">{c.informacao.length}/320</span></label>
                          <textarea id={`card-${c.id}-info`} rows={2} maxLength={320} value={c.informacao} onChange={(e) => mudar(c.id, { informacao: e.target.value } as Partial<CardFazenda>)} />
                          <p className="suave pequeno dica-campo">Escreva só o que você pode sustentar perante o comprador. Dados técnicos ficam na origem: vincule em vez de copiar.</p>
                        </>
                      )}
                    </fieldset>
                    <div className="cda-cheio">
                      <label htmlFor={`card-${c.id}-compl`}>Complemento (opcional) <span className="cda-cont">{c.complemento.length}/240</span></label>
                      <textarea id={`card-${c.id}-compl`} rows={2} maxLength={240} value={c.complemento} onChange={(e) => mudar(c.id, { complemento: e.target.value })} />
                    </div>
                  </div>
                  {medida && <p className="cda-nota">Parece uma medida de área em texto livre, que será recusada ao salvar. Use um card vinculado a “Área pública”.</p>}
                  {p.length > 0 && <ul className="cda-erros" role="alert">{p.map((x) => <li key={x}>{x}</li>)}</ul>}
                </li>
              );
            })}
          </ol>
        )}

        <div className="painel cda-novo">
          <div className="linha">
            <button type="button" className="btn sec" disabled={cheio} onClick={() => adicionar({ tipo: "vinculado", origem: "regiao", titulo: "", complemento: "", icone: "info", visivel: true } as Omit<CardFazenda, "id">)}><Plus aria-hidden="true" />Card vinculado</button>
            <button type="button" className="btn sec" disabled={cheio} onClick={() => adicionar({ tipo: "editorial", informacao: "", titulo: "", complemento: "", icone: "info", visivel: true } as Omit<CardFazenda, "id">)}><Plus aria-hidden="true" />Texto do corretor</button>
            <span className="suave pequeno">{v.length} de {LIMITE_CARDS}{cheio ? " · limite atingido" : ""}</span>
          </div>
          <p className="suave pequeno cda-sug-legenda">Temas sugeridos: criam um card oculto e em branco só com o título. Nada é preenchido por você; escreva o texto antes de salvar.</p>
          <div className="cda-sug">
            {SUGESTOES.map((s) => (
              <button key={s.tema} type="button" className="cda-chip" disabled={cheio || temasUsados.has(s.titulo.toLowerCase())}
                onClick={() => adicionar({ tipo: "editorial", informacao: "", titulo: s.titulo, complemento: "", icone: s.icone, visivel: false } as Omit<CardFazenda, "id">)}>
                <Plus aria-hidden="true" />{s.titulo}
              </button>
            ))}
          </div>
        </div>

        <div className="salvar-barra cda-barra">
          <button className="btn" type="submit" disabled={!sujo || totalErros > 0}>Salvar cards</button>
          {sujo && <button type="button" className="btn sec" onClick={async () => { if (await confirmar({ titulo: "Descartar alterações nos cards?", texto: "A lista volta a ser a última versão salva.", confirmar: "Descartar", perigo: true })) { descartar(); setSalvoAgora(false); } }}>Descartar alterações</button>}
          <span className="suave pequeno" role="status">{totalErros ? `${totalErros} card(s) precisam de ajuste antes de salvar.` : sujo ? "Há alterações não salvas." : "Tudo salvo."}</span>
        </div>
      </form>

      <div className="painel cda-previa">
        <div className="cda-previa-topo">
          <h3>Prévia no site</h3>
          <span className="suave pequeno">{previa.length} {previa.length === 1 ? "card visível" : "cards visíveis"}{sujo ? " · inclui alterações não salvas" : ""}</span>
        </div>
        <p className="suave pequeno">Mesmo componente do site. Alterações não salvas ainda dependem da checagem de privacidade do servidor ao salvar.</p>
        {previa.length === 0
          ? <p className="cda-previa-vazia">Nenhum card aparece no site com esta configuração.</p>
          : <div className="cda-previa-palco"><CardsFazenda cards={previa} rotulo="Prévia dos cards" /></div>}
      </div>
    </div>
  );
}
