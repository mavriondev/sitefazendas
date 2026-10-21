import { useEffect, useState } from "react";
import { api } from "../api";
import { useSite } from "../contexto";
import { Erro, Ok, Aviso } from "../components/Avisos";

export default function ConfigAdmin() {
  const { recarregar } = useSite();
  const [c, setC] = useState<any>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  useEffect(() => { void api.get("/api/admin/config").then(setC).catch(setErro); }, []);
  if (!c) return <Erro erro={erro} />;
  const salvar = async (parcial: Record<string, unknown>) => {
    setErro(null); setOk("");
    try { setC(await api.put("/api/admin/config", parcial)); setOk("Salvo."); await recarregar(); } catch (x) { setErro(x); }
  };
  const set = (k: string) => (e: any) => setC({ ...c, [k]: e.target.value });
  return (
    <>
      <h1>Configurações</h1>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <div className="painel">
        <h3>Pesquisa de terras (módulo B)</h3>
        <label className="interruptor">
          <input type="checkbox" checked={!!c.modulo_pesquisa_ativo} onChange={(e) => salvar({ modulo_pesquisa_ativo: e.target.checked })} />
          <span className="chave" /> {c.modulo_pesquisa_ativo ? "Ligada" : "Desligada"}
        </label>
        <p className="suave pequeno">Desligada: a pesquisa some do site e o servidor recusa as consultas. O enriquecimento das fazendas do cadastro continua funcionando.</p>
        <div style={{ maxWidth: 240 }}><label htmlFor="lim">Pesquisas por usuário por hora</label><input id="lim" inputMode="numeric" value={c.pesquisa_limite_hora} onChange={set("pesquisa_limite_hora")} onBlur={() => salvar({ pesquisa_limite_hora: Number(c.pesquisa_limite_hora) })} /></div>
      </div>
      <div className="painel">
        <h3>Site</h3>
        <label htmlFor="ns">Nome do site</label><input id="ns" value={c.nome_site} onChange={set("nome_site")} />
        <label htmlFor="wp">WhatsApp padrão (com DDD)</label><input id="wp" value={c.whatsapp_padrao} onChange={set("whatsapp_padrao")} />
        <label htmlFor="ht">Título da home (sem slides)</label><input id="ht" value={c.hero_titulo} onChange={set("hero_titulo")} />
        <label htmlFor="hs">Subtítulo da home</label><input id="hs" value={c.hero_subtitulo} onChange={set("hero_subtitulo")} />
        <label htmlFor="cr">Texto do CRECI / identificação profissional</label>
        <input id="cr" value={c.texto_creci} onChange={set("texto_creci")} placeholder="Ex.: Nome Completo — CRECI/UF 00000" />
        {!c.texto_creci && <Aviso>Preencha o CRECI antes de divulgar o site: a intermediação de imóveis exige identificação do corretor.</Aviso>}
        <label htmlFor="av">Aviso de intermediação (rodapé)</label><textarea id="av" rows={3} value={c.aviso_intermediacao} onChange={set("aviso_intermediacao")} />
        <button className="btn" onClick={() => salvar({ nome_site: c.nome_site, whatsapp_padrao: c.whatsapp_padrao, hero_titulo: c.hero_titulo, hero_subtitulo: c.hero_subtitulo, texto_creci: c.texto_creci, aviso_intermediacao: c.aviso_intermediacao })}>Salvar</button>
      </div>
    </>
  );
}
