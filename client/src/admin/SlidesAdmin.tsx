import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Erro, Ok } from "../components/Avisos";

export default function SlidesAdmin() {
  const [slides, setSlides] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const carregar = useCallback(async () => {
    try { const [s, f] = await Promise.all([api.get("/api/admin/slides"), api.get("/api/admin/fazendas")]); setSlides(s.slides); setFazendas(f.fazendas); } catch (x) { setErro(x); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  const acao = async (fn: () => Promise<unknown>, m = "Salvo.") => { setErro(null); setOk(""); try { await fn(); setOk(m); await carregar(); } catch (x) { setErro(x); } };
  return (
    <>
      <h1>Slides da home</h1>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <button className="btn" onClick={() => acao(() => api.post("/api/admin/slides", { titulo: "Novo slide", link_tipo: "nenhum", ordem: slides.length, ativo: false }), "Slide criado (inativo até enviar a imagem).")}>Novo slide</button>
      {slides.map((s) => <Slide key={s.id} s={s} fazendas={fazendas} acao={acao} />)}
    </>
  );
}

function Slide({ s, fazendas, acao }: { s: any; fazendas: any[]; acao: any }) {
  const [v, setV] = useState({ titulo: s.titulo ?? "", subtitulo: s.subtitulo ?? "", link_tipo: s.link_tipo, fazenda_id: s.fazenda_id ?? "", url: s.url ?? "", ordem: s.ordem, ativo: s.ativo });
  const set = (k: string) => (e: any) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <div className="painel">
      <div className="linha">
        {s.arquivo ? <img src={`/uploads/${s.arquivo}`} alt="" style={{ width: 140, height: 80, objectFit: "cover", borderRadius: 6 }} /> : <span className="etiqueta">sem imagem</span>}
        <input type="file" accept="image/jpeg,image/png" onChange={(e) => { const a = e.target.files?.[0]; if (a) void acao(() => api.upload(`/api/admin/slides/${s.id}/imagem`, a), "Imagem enviada."); }} />
      </div>
      <div className="filtros">
        <div><label>Título</label><input value={v.titulo} onChange={set("titulo")} /></div>
        <div><label>Subtítulo</label><input value={v.subtitulo} onChange={set("subtitulo")} /></div>
        <div><label>Link</label><select value={v.link_tipo} onChange={set("link_tipo")}><option value="nenhum">Nenhum</option><option value="fazenda">Uma fazenda</option><option value="url">Endereço externo</option></select></div>
        {v.link_tipo === "fazenda" && <div><label>Fazenda</label><select value={v.fazenda_id} onChange={set("fazenda_id")}><option value="">Escolha</option>{fazendas.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}</select></div>}
        {v.link_tipo === "url" && <div><label>URL</label><input value={v.url} onChange={set("url")} placeholder="https://" /></div>}
        <div><label>Ordem</label><input inputMode="numeric" value={v.ordem} onChange={set("ordem")} /></div>
      </div>
      <label className="linha" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={v.ativo} onChange={set("ativo")} />Ativo na home</label>
      <div className="linha">
        <button className="btn" onClick={() => acao(() => api.put(`/api/admin/slides/${s.id}`, { ...v, fazenda_id: v.link_tipo === "fazenda" ? Number(v.fazenda_id) : undefined, ordem: Number(v.ordem) || 0 }))}>Salvar</button>
        <button className="btn sec" onClick={() => { if (confirm("Remover este slide?")) void acao(() => api.del(`/api/admin/slides/${s.id}`), "Slide removido."); }}>Remover</button>
      </div>
    </div>
  );
}
