import { useEffect, useState } from "react";
import { api } from "../api";
import { useSite } from "../contexto";
import { Erro, Ok, Aviso } from "../components/Avisos";
import { Campo, difere, useAcaoUnica, useAvisoAlteracao, useConfirmar } from "./comuns";

const GRUPO_PESQUISA = ["pesquisa_limite_hora"] as const;
const GRUPO_SITE = ["nome_site", "whatsapp_padrao", "hero_titulo", "hero_subtitulo", "texto_creci", "aviso_intermediacao"] as const;
const GRUPO_SOBRE = ["sobre_titulo", "sobre_texto", "contato_email", "contato_endereco", "contato_horario", "instagram_url"] as const;
const pegar = (o: any, chaves: readonly string[]) => Object.fromEntries(chaves.map((k) => [k, o?.[k]]));

export default function ConfigAdmin() {
  const { recarregar } = useSite();
  const [srv, setSrv] = useState<any>(null);   // último valor salvo no servidor
  const [c, setC] = useState<any>(null);       // rascunho
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const [confirmar, dialogo] = useConfirmar();
  useEffect(() => { void api.get("/api/admin/config").then((r) => { setSrv(r); setC(r); }).catch(setErro); }, []);

  const sujoPesquisa = difere(pegar(c, GRUPO_PESQUISA), pegar(srv, GRUPO_PESQUISA));
  const sujoSite = difere(pegar(c, GRUPO_SITE), pegar(srv, GRUPO_SITE));
  const sujoSobre = difere(pegar(c, GRUPO_SOBRE), pegar(srv, GRUPO_SOBRE));
  useAvisoAlteracao(!!c && (sujoPesquisa || sujoSite || sujoSobre));

  // Salva só os campos do grupo; os demais rascunhos continuam intactos.
  const [salvar, ocupado] = useAcaoUnica(async (parcial: Record<string, unknown>, mensagem: string = "Salvo.") => {
    setErro(null); setOk("");
    try {
      const r = await api.put("/api/admin/config", parcial);
      setSrv((a: any) => ({ ...a, ...pegar(r, Object.keys(parcial)) }));
      setC((a: any) => ({ ...a, ...pegar(r, Object.keys(parcial)) }));
      setOk(mensagem); await recarregar();
    } catch (x) { setErro(x); }
  });
  if (!c) return <Erro erro={erro} />;
  const set = (k: string) => (e: any) => setC({ ...c, [k]: e.target.value });

  const alternarPesquisa = async (ligar: boolean) => {
    if (ligar && !(await confirmar({ titulo: "Ligar a pesquisa de terras?", texto: "O módulo passa a aparecer no site e a consultar a Hub. Confirme só se o acesso e a chave da Hub já estiverem prontos.", confirmar: "Ligar pesquisa" }))) return;
    void salvar({ modulo_pesquisa_ativo: ligar }, ligar ? "Pesquisa ligada." : "Pesquisa desligada.");
  };
  const barra = (sujo: boolean, onSalvar: () => void) => (
    <div className="salvar-barra">
      <button className="btn" disabled={!sujo} onClick={onSalvar}>Salvar alterações</button>
      <span className="suave pequeno" role="status">{sujo ? "Há alterações não salvas." : "Tudo salvo."}</span>
    </div>
  );
  return (
    <div aria-busy={ocupado} className={ocupado ? "ocupado" : ""}>
      <h1>Configurações</h1>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <div className="painel painel-form">
        <h3>Pesquisa de terras (módulo B)</h3>
        <label className="interruptor">
          <input type="checkbox" checked={!!srv.modulo_pesquisa_ativo} onChange={(e) => void alternarPesquisa(e.target.checked)} />
          <span className="chave" /> {srv.modulo_pesquisa_ativo ? "Ligada" : "Desligada"}
        </label>
        <p className="suave pequeno">Este interruptor age na hora. Desligada: a pesquisa some do site e o servidor recusa as consultas. O enriquecimento das fazendas do cadastro continua funcionando.</p>
        <div style={{ maxWidth: 260 }}><Campo rotulo="Pesquisas por usuário por hora"><input inputMode="numeric" value={c.pesquisa_limite_hora} onChange={set("pesquisa_limite_hora")} /></Campo></div>
        {barra(sujoPesquisa, () => salvar({ pesquisa_limite_hora: Number(c.pesquisa_limite_hora) }))}
      </div>
      <div className="painel painel-form">
        <h3>Site</h3>
        <Campo rotulo="Nome do site"><input value={c.nome_site} onChange={set("nome_site")} /></Campo>
        <Campo rotulo="WhatsApp padrão (com DDD)"><input value={c.whatsapp_padrao} onChange={set("whatsapp_padrao")} /></Campo>
        <Campo rotulo="Título da home (sem slides)"><input value={c.hero_titulo} onChange={set("hero_titulo")} /></Campo>
        <Campo rotulo="Subtítulo da home"><input value={c.hero_subtitulo} onChange={set("hero_subtitulo")} /></Campo>
        <Campo rotulo="Texto do CRECI / identificação profissional"><input value={c.texto_creci} onChange={set("texto_creci")} placeholder="Ex.: Nome Completo — CRECI/UF 00000" /></Campo>
        {!c.texto_creci && <Aviso>Preencha o CRECI antes de divulgar o site: a intermediação de imóveis exige identificação do corretor.</Aviso>}
        <Campo rotulo="Aviso de intermediação (rodapé)"><textarea rows={3} value={c.aviso_intermediacao} onChange={set("aviso_intermediacao")} /></Campo>
        {barra(sujoSite, () => salvar(pegar(c, GRUPO_SITE)))}
      </div>
      <div className="painel painel-form">
        <h3>Páginas Sobre e Contato</h3>
        <Campo rotulo="Título da página Sobre"><input value={c.sobre_titulo} onChange={set("sobre_titulo")} /></Campo>
        <Campo rotulo="Texto do Sobre" dica="Deixe uma linha em branco entre os parágrafos."><textarea rows={10} value={c.sobre_texto} onChange={set("sobre_texto")} /></Campo>
        <Campo rotulo="E-mail de contato"><input type="email" value={c.contato_email} onChange={set("contato_email")} /></Campo>
        <Campo rotulo="Endereço"><input value={c.contato_endereco} onChange={set("contato_endereco")} /></Campo>
        <Campo rotulo="Horário de atendimento"><input value={c.contato_horario} onChange={set("contato_horario")} /></Campo>
        <Campo rotulo="Instagram" dica="Endereço completo, começando com https://"><input value={c.instagram_url} onChange={set("instagram_url")} /></Campo>
        {barra(sujoSobre, () => salvar(pegar(c, GRUPO_SOBRE)))}
      </div>
      {dialogo}
    </div>
  );
}
