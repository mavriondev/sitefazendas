import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Erro, Ok } from "../components/Avisos";
import { Campo, difere, useAcaoUnica, useAvisoAlteracao, useConfirmar } from "./comuns";

export default function ParceirosAdmin() {
  const [l, setL] = useState<any[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const [nome, setNome] = useState("");
  const [confirmar, dialogo] = useConfirmar();
  const carregar = useCallback(() => api.get("/api/admin/parceiros").then((r) => setL(r.parceiros)).catch(setErro), []);
  useEffect(() => { void carregar(); }, [carregar]);
  const [acao, ocupado] = useAcaoUnica(async (fn: () => Promise<unknown>, m: string = "Salvo.") => {
    setErro(null); setOk(""); try { await fn(); setOk(m); await carregar(); } catch (x) { setErro(x); }
  });
  return (
    <div aria-busy={ocupado} className={ocupado ? "ocupado" : ""}>
      <h1>Parceiros</h1>
      <p className="suave">Aparecem na página Parceiros e na home. Envie o logo em JPEG ou PNG (de preferência com fundo branco ou transparente).</p>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <form className="painel linha" onSubmit={(e) => { e.preventDefault(); void acao(async () => { await api.post("/api/admin/parceiros", { nome, ordem: l.length }); setNome(""); }, "Parceiro criado."); }}>
        <input required aria-label="Nome do novo parceiro" placeholder="Nome do parceiro" value={nome} onChange={(e) => setNome(e.target.value)} />
        <button className="btn" type="submit">Adicionar</button>
      </form>
      {l.length === 0 && <p className="suave">Nenhum parceiro cadastrado.</p>}
      {l.map((p) => <Linha key={p.id} p={p} acao={acao} confirmar={confirmar} />)}
      {dialogo}
    </div>
  );
}

function Linha({ p, acao, confirmar }: { p: any; acao: any; confirmar: ReturnType<typeof useConfirmar>[0] }) {
  const doServidor = { nome: p.nome, url: p.url ?? "", ordem: p.ordem, ativo: p.ativo };
  const [v, setV] = useState(doServidor);
  const sujo = difere(v, doServidor);
  useAvisoAlteracao(sujo);
  return (
    <div className="painel">
      <div className="linha">
        {p.arquivo ? <img src={`/uploads/${p.arquivo}`} alt={`Logo de ${p.nome}`} style={{ height: 56, maxWidth: 140, objectFit: "contain", background: "#fff", border: "1px solid var(--linha)", borderRadius: 8, padding: 4 }} /> : <span className="etiqueta">sem logo</span>}
        <input type="file" aria-label={`Enviar logo de ${p.nome}`} accept="image/jpeg,image/png" onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; if (a) void acao(() => api.upload(`/api/admin/parceiros/${p.id}/logo`, a), "Logo enviado."); }} />
      </div>
      <div className="filtros">
        <Campo rotulo="Nome"><input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></Campo>
        <Campo rotulo="Site (opcional)"><input placeholder="https://" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} /></Campo>
        <Campo rotulo="Ordem"><input inputMode="numeric" value={v.ordem} onChange={(e) => setV({ ...v, ordem: e.target.value })} /></Campo>
      </div>
      <label className="linha" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} />Visível no site</label>
      <div className="salvar-barra">
        <button className="btn" disabled={!sujo} onClick={() => acao(() => api.put(`/api/admin/parceiros/${p.id}`, { ...v, ordem: Number(v.ordem) || 0 }))}>Salvar parceiro</button>
        <button className="btn sec perigo" onClick={async () => { if (await confirmar({ titulo: `Remover ${p.nome}?`, texto: "O parceiro e o logo deixam de aparecer no site.", confirmar: "Remover parceiro", perigo: true })) void acao(() => api.del(`/api/admin/parceiros/${p.id}`), "Parceiro removido."); }}>Remover</button>
        <span className="suave pequeno" role="status">{sujo ? "Há alterações não salvas." : ""}</span>
      </div>
    </div>
  );
}
