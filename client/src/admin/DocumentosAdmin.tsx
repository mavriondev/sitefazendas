import { useRef, useState } from "react";
import { api } from "../api";
import { Aviso } from "../components/Avisos";
import { CATEGORIAS_DOCUMENTO, MAX_DOCUMENTO } from "../../../shared/documentos";
import type { useConfirmar } from "./comuns";

interface Documento { id: number; nome: string; categoria: string; descricao: string; tamanho: number; criado_em: string }
type Confirmar = ReturnType<typeof useConfirmar>[0];
type Acao = (fn: () => Promise<unknown>, msg?: string) => Promise<void>;
const tamanho = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/** Documentos privados: o site público nunca os mostra; o CRM interno os usa para baixar. */
export function DocumentosAdmin({ id, documentos, acao, confirmar }: { id: string; documentos: Documento[]; acao: Acao; confirmar: Confirmar }) {
  const [categoria, setCategoria] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const grupos: Array<{ c: string; itens: Documento[] }> = CATEGORIAS_DOCUMENTO.map((c) => ({ c: c as string, itens: documentos.filter((d) => d.categoria === c) }));
  const outras = documentos.filter((d) => !(CATEGORIAS_DOCUMENTO as readonly string[]).includes(d.categoria));
  if (outras.length) grupos.push({ c: "Outras categorias", itens: outras });

  const enviar = async (arquivos: File[]) => {
    setErro("");
    if (!categoria) { setErro("Escolha o tipo do documento antes de enviar."); return; }
    for (const a of arquivos) {
      if (a.size > MAX_DOCUMENTO) { setErro(`"${a.name}" passa de 12 MB.`); continue; }
      await acao(() => api.upload(`/api/admin/fazendas/${id}/documentos`, a, { categoria, descricao }), `"${a.name}" enviado.`);
    }
    setDescricao("");
  };
  return (
    <section className="painel">
      <h3>Documentos</h3>
      <p className="suave pequeno">Matrícula, CAR, mapas e outros arquivos da fazenda. <strong>Não aparecem no site público.</strong> Só você aqui no painel e a equipe no CRM conseguem baixar. PDF, JPEG ou PNG, até 12 MB.</p>
      <Aviso>Esses arquivos podem conter CAR, município e nome do proprietário. Envie só o que a equipe precisa.</Aviso>
      <div className="linha" role="group" aria-label="Tipo do documento">
        {CATEGORIAS_DOCUMENTO.map((c) => <button key={c} type="button" className={`btn sec${categoria === c ? " ativo" : ""}`} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>)}
      </div>
      <label className="campo">Descrição (opcional)
        <input value={descricao} maxLength={300} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: matrícula 12.345, certidão atualizada" />
      </label>
      <input ref={entrada} type="file" aria-label="Enviar documentos" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple
        onChange={(e) => { const a = Array.from(e.target.files ?? []); e.target.value = ""; void enviar(a); }} />
      {erro && <p role="alert" className="msg erro">{erro}</p>}
      {!documentos.length && <p>Nenhum documento enviado para esta fazenda.</p>}
      {grupos.filter((g) => g.itens.length).map(({ c, itens }) => (
        <div key={c}>
          <h4>{c} <span className="etiqueta">{itens.length}</span></h4>
          {itens.map((d) => (
            <div className="linha" key={d.id}>
              <div style={{ flex: 1, minWidth: 0 }}><strong>{d.nome}</strong><div className="suave pequeno">{d.descricao ? `${d.descricao} · ` : ""}{tamanho(d.tamanho)}</div></div>
              <a className="btn sec" href={`/api/admin/documentos/${d.id}/baixar`} download={d.nome}>Baixar</a>
              <button className="btn sec perigo" onClick={async () => { if (await confirmar({ titulo: "Remover este documento?", texto: `"${d.nome}" será apagado e deixará de aparecer no CRM.`, confirmar: "Remover documento", perigo: true })) void acao(() => api.del(`/api/admin/documentos/${d.id}`), "Documento removido."); }}>Remover</button>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
