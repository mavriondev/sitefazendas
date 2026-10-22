import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Erro, Ok } from "../components/Avisos";
import { Campo, difere, useAcaoUnica, useAvisoAlteracao, useConfirmar } from "./comuns";

export default function SlidesAdmin() {
  const [slides, setSlides] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const [confirmar, dialogo] = useConfirmar();
  const carregar = useCallback(async () => {
    try { const [s, f] = await Promise.all([api.get("/api/admin/slides"), api.get("/api/admin/fazendas")]); setSlides(s.slides); setFazendas(f.fazendas); } catch (x) { setErro(x); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  const [acao, ocupado] = useAcaoUnica(async (fn: () => Promise<unknown>, m: string = "Salvo.") => {
    setErro(null); setOk(""); try { await fn(); setOk(m); await carregar(); } catch (x) { setErro(x); }
  });
  return (
    <div aria-busy={ocupado} className={ocupado ? "ocupado" : ""}>
      <h1>Slides da home</h1>
      <p className="suave">Cada slide precisa de uma imagem para aparecer na home. Slides inativos ficam guardados e não aparecem no site. A ordem é pelo número (menor primeiro).</p>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <button className="btn" onClick={() => acao(() => api.post("/api/admin/slides", { titulo: "Novo slide", link_tipo: "nenhum", ordem: slides.length, ativo: false }), "Slide criado (inativo até enviar a imagem).")}>Novo slide</button>
      {slides.length === 0 && <p className="suave">Nenhum slide cadastrado.</p>}
      {slides.map((s) => <Slide key={s.id} s={s} fazendas={fazendas} acao={acao} confirmar={confirmar} />)}
      {dialogo}
    </div>
  );
}

function Slide({ s, fazendas, acao, confirmar }: { s: any; fazendas: any[]; acao: any; confirmar: ReturnType<typeof useConfirmar>[0] }) {
  const doServidor = { titulo: s.titulo ?? "", subtitulo: s.subtitulo ?? "", link_tipo: s.link_tipo, fazenda_id: s.fazenda_id ?? "", url: s.url ?? "", ordem: s.ordem, ativo: s.ativo };
  const [v, setV] = useState(doServidor);
  const sujo = difere(v, doServidor);
  useAvisoAlteracao(sujo);
  const set = (k: string) => (e: any) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <div className="painel">
      <div className="linha">
        {s.arquivo ? <img src={`/uploads/${s.arquivo}`} alt={`Imagem do slide ${v.titulo || s.id}`} style={{ width: 140, height: 80, objectFit: "cover", borderRadius: 6 }} /> : <span className="etiqueta">sem imagem</span>}
        <input type="file" aria-label={`Enviar imagem do slide ${v.titulo || s.id}`} accept="image/jpeg,image/png" onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; if (a) void acao(() => api.upload(`/api/admin/slides/${s.id}/imagem`, a), "Imagem enviada."); }} />
      </div>
      <div className="filtros">
        <Campo rotulo="Título"><input value={v.titulo} onChange={set("titulo")} /></Campo>
        <Campo rotulo="Subtítulo"><input value={v.subtitulo} onChange={set("subtitulo")} /></Campo>
        <Campo rotulo="Link"><select value={v.link_tipo} onChange={set("link_tipo")}><option value="nenhum">Nenhum</option><option value="fazenda">Uma fazenda</option><option value="url">Endereço externo</option></select></Campo>
        {v.link_tipo === "fazenda" && <Campo rotulo="Fazenda"><select value={v.fazenda_id} onChange={set("fazenda_id")}><option value="">Escolha</option>{fazendas.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}</select></Campo>}
        {v.link_tipo === "url" && <Campo rotulo="URL"><input value={v.url} onChange={set("url")} placeholder="https://" /></Campo>}
        <Campo rotulo="Ordem"><input inputMode="numeric" value={v.ordem} onChange={set("ordem")} /></Campo>
      </div>
      <label className="linha" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={v.ativo} onChange={set("ativo")} />Ativo na home</label>
      <div className="salvar-barra">
        <button className="btn" disabled={!sujo} onClick={() => acao(() => api.put(`/api/admin/slides/${s.id}`, { ...v, fazenda_id: v.link_tipo === "fazenda" ? Number(v.fazenda_id) : undefined, ordem: Number(v.ordem) || 0 }))}>Salvar slide</button>
        <button className="btn sec" onClick={async () => { if (await confirmar({ titulo: "Remover este slide?", texto: "A imagem e o texto deste slide serão apagados.", confirmar: "Remover slide", perigo: true })) void acao(() => api.del(`/api/admin/slides/${s.id}`), "Slide removido."); }}>Remover</button>
        <span className="suave pequeno" role="status">{sujo ? "Há alterações não salvas." : ""}</span>
      </div>
    </div>
  );
}
