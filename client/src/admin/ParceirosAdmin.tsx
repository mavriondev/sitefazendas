import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Erro, Ok } from "../components/Avisos";

export default function ParceirosAdmin() {
  const [l, setL] = useState<any[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const [nome, setNome] = useState("");
  const carregar = useCallback(() => api.get("/api/admin/parceiros").then((r) => setL(r.parceiros)).catch(setErro), []);
  useEffect(() => { void carregar(); }, [carregar]);
  const acao = async (fn: () => Promise<unknown>, m = "Salvo.") => { setErro(null); setOk(""); try { await fn(); setOk(m); await carregar(); } catch (x) { setErro(x); } };
  return (
    <>
      <h1>Parceiros</h1>
      <p className="suave">Aparecem na página Parceiros e na home. Envie o logo em JPEG ou PNG (de preferência com fundo branco ou transparente).</p>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <form className="painel linha" onSubmit={(e) => { e.preventDefault(); void acao(async () => { await api.post("/api/admin/parceiros", { nome, ordem: l.length }); setNome(""); }, "Parceiro criado."); }}>
        <input required placeholder="Nome do parceiro" value={nome} onChange={(e) => setNome(e.target.value)} />
        <button className="btn" type="submit">Adicionar</button>
      </form>
      {l.map((p) => <Linha key={p.id} p={p} acao={acao} />)}
    </>
  );
}

function Linha({ p, acao }: { p: any; acao: any }) {
  const [v, setV] = useState({ nome: p.nome, url: p.url ?? "", ordem: p.ordem, ativo: p.ativo });
  return (
    <div className="painel">
      <div className="linha">
        {p.arquivo ? <img src={`/uploads/${p.arquivo}`} alt="" style={{ height: 56, maxWidth: 140, objectFit: "contain", background: "#fff", border: "1px solid var(--linha)", borderRadius: 8, padding: 4 }} /> : <span className="etiqueta">sem logo</span>}
        <input type="file" accept="image/jpeg,image/png" onChange={(e) => { const a = e.target.files?.[0]; if (a) void acao(() => api.upload(`/api/admin/parceiros/${p.id}/logo`, a), "Logo enviado."); }} />
      </div>
      <div className="filtros">
        <div><label>Nome</label><input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></div>
        <div><label>Site (opcional)</label><input placeholder="https://" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} /></div>
        <div><label>Ordem</label><input inputMode="numeric" value={v.ordem} onChange={(e) => setV({ ...v, ordem: e.target.value })} /></div>
      </div>
      <label className="linha" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} />Visível no site</label>
      <div className="linha">
        <button className="btn" onClick={() => acao(() => api.put(`/api/admin/parceiros/${p.id}`, { ...v, ordem: Number(v.ordem) || 0 }))}>Salvar</button>
        <button className="btn sec" onClick={() => { if (confirm(`Remover ${p.nome}?`)) void acao(() => api.del(`/api/admin/parceiros/${p.id}`), "Parceiro removido."); }}>Remover</button>
      </div>
    </div>
  );
}
