import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Erro, Ok, Aviso } from "../components/Avisos";
import { VideosAdmin } from "./VideosAdmin";
import { Campo, useAcaoUnica, useConfirmar, useFormularioComRascunho } from "./comuns";

type Confirmar = ReturnType<typeof useConfirmar>[0];
type Aba = "dados" | "atributos" | "fotos" | "videos" | "publicar";
const ESTADO_ROTULO: Record<string, string> = { confirmado: "Confirmado", indicado: "Indicado por fonte", sem_dado: "Sem dado" };

export default function FazendaEditor() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [aba, setAba] = useState<Aba>("dados");
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const carregar = useCallback(async () => { try { setD(await api.get(`/api/admin/fazendas/${id}`)); } catch (x) { setErro(x); } }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  const [acao, ocupado] = useAcaoUnica(async (fn: () => Promise<unknown>, msg: string = "Salvo.") => {
    setErro(null); setOk("");
    try { await fn(); setOk(msg); await carregar(); } catch (x) { setErro(x); await carregar(); }
  });
  const [confirmar, dialogo] = useConfirmar();
  if (!d) return <><Erro erro={erro} /><p className="suave">Carregando…</p></>;
  const f = d.fazenda;
  return (
    <>
      <p><Link to="/admin">← Fazendas</Link></p>
      <h1>{f.titulo} <span className="etiqueta">{f.status}</span></h1>
      <div className="abas" role="tablist" aria-label="Seções da fazenda" onKeyDown={(e) => {
        const abas: Aba[] = ["dados", "atributos", "fotos", "videos", "publicar"];
        const i = abas.indexOf(aba);
        const j = e.key === "ArrowRight" ? (i + 1) % abas.length : e.key === "ArrowLeft" ? (i + abas.length - 1) % abas.length : e.key === "Home" ? 0 : e.key === "End" ? abas.length - 1 : -1;
        if (j < 0) return;
        e.preventDefault(); setAba(abas[j]);
        requestAnimationFrame(() => document.getElementById(`aba-${abas[j]}`)?.focus());
      }}>{(["dados", "atributos", "fotos", "videos", "publicar"] as Aba[]).map((a) => (
        <button key={a} id={`aba-${a}`} role="tab" aria-selected={aba === a} aria-controls="painel-aba" tabIndex={aba === a ? 0 : -1}
          className={aba === a ? "ativo" : ""} onClick={() => setAba(a)}>{{ dados: "Dados", atributos: "Dados da terra", fotos: "Fotos", videos: "Vídeos", publicar: "Publicação" }[a]}</button>))}</div>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      <div id="painel-aba" role="tabpanel" aria-labelledby={`aba-${aba}`} aria-busy={ocupado} className={ocupado ? "ocupado" : ""}>
        <div hidden={aba !== "dados"}><Dados key={String(f.atualizado_em)} f={f} acao={acao} id={id!} confirmar={confirmar} /></div>
        {aba === "atributos" && <Atributos d={d} acao={acao} id={id!} confirmar={confirmar} />}
        {aba === "fotos" && <Fotos d={d} acao={acao} id={id!} confirmar={confirmar} />}
        {aba === "videos" && <VideosAdmin videos={d.videos ?? []} acao={acao} id={id!} confirmar={confirmar}/>}
        {aba === "publicar" && <Publicar d={d} acao={acao} id={id!} confirmar={confirmar} />}
      </div>
      {dialogo}
    </>
  );
}

function Dados({ f, acao, id, confirmar }: { f: any; acao: any; id: string; confirmar: Confirmar }) {
  const inicial = {
    titulo: f.titulo ?? "", regiao_publica: f.regiao_publica ?? "", culturas: (f.culturas ?? []).join(", "), area_ha: f.area_ha ?? "",
    area_exibicao: f.area_exibicao, preco_exibicao: f.preco_exibicao ?? "", descricao_publica: f.descricao_publica ?? "",
    destaque: f.destaque, destaque_ordem: f.destaque_ordem ?? 0, mostrar_mapa: f.mostrar_mapa, mostrar_regiao: f.mostrar_regiao, geojson_novo: "", whatsapp_proprio: f.whatsapp_proprio ?? "",
    car_codigo: f.car_codigo ?? "", municipio: f.municipio ?? "", uf: f.uf ?? "", latitude: f.latitude ?? "", longitude: f.longitude ?? "", notas_internas: f.notas_internas ?? "",
  };
  const { v, setV, sujo, recuperado, descartar } = useFormularioComRascunho(`rascunho-fazenda-${id}`, inicial);
  const [sug, setSug] = useState("");
  const [obs, setObs] = useState("");
  const [erroIA, setErroIA] = useState<unknown>(null);
  const [iaBusy, setIaBusy] = useState(false);
  const num = (s: any) => (s === "" || s == null ? null : Number(String(s).replace(",", ".")));
  const set = (k: string) => (e: any) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    void acao(() => api.put(`/api/admin/fazendas/${id}`, {
      ...v, culturas: v.culturas.split(",").map((s: string) => s.trim()).filter(Boolean), area_ha: num(v.area_ha),
      latitude: num(v.latitude), longitude: num(v.longitude), destaque_ordem: Number(v.destaque_ordem) || 0,
      geojson_novo: undefined, ...(v.geojson_novo.trim() ? { geojson: v.geojson_novo.trim() } : {}),
    }));
  };
  const sugerir = async () => {
    setErroIA(null); setIaBusy(true);
    try { setSug((await api.post(`/api/admin/fazendas/${id}/texto-ia`, { observacoes: obs })).sugestao); } catch (x) { setErroIA(x); } finally { setIaBusy(false); }
  };
  const T = (k: string, r: string, extra: any = {}) => <div><label htmlFor={k}>{r}</label><input id={k} value={(v as any)[k]} onChange={set(k)} {...extra} /></div>;
  return (
    <>
      <form onSubmit={salvar} className="painel">
        {recuperado && sujo && <Aviso>Recuperamos o que você digitou e ainda não tinha salvo. Revise e salve, ou <button type="button" className="link-acao" onClick={descartar}>descarte as alterações</button>.</Aviso>}
        {T("titulo", "Título")}{T("regiao_publica", "Região (pública, ampla: ex. Sul de Goiás)")}{T("culturas", "Culturas (separadas por vírgula)")}
        <div className="filtros">
          {T("area_ha", "Área (ha)", { inputMode: "decimal" })}
          <div><label htmlFor="ae">Exibir área como</label><select id="ae" value={v.area_exibicao} onChange={set("area_exibicao")}><option value="faixa">Faixa</option><option value="exata">Exata</option></select></div>
          {T("preco_exibicao", "Valor exibido (texto livre, opcional)")}{T("whatsapp_proprio", "WhatsApp desta fazenda (vazio = padrão)")}
        </div>
        <label htmlFor="desc">Descrição pública</label><textarea id="desc" rows={6} value={v.descricao_publica} onChange={set("descricao_publica")} />
        <label className="linha" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={v.destaque} onChange={set("destaque")} />Destaque na home</label>
        <div style={{ maxWidth: 200 }}>{T("destaque_ordem", "Ordem do destaque (menor primeiro)", { inputMode: "numeric" })}</div>
        <label className="linha" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={v.mostrar_mapa} onChange={set("mostrar_mapa")} />Mostrar silhueta do imóvel (exige polígono)</label>
        <label className="linha" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={v.mostrar_regiao} onChange={set("mostrar_regiao")} />Mostrar mapa da região aproximada (círculo de 12 km; exige latitude e longitude)</label>
        <h3>Dados privados (nunca aparecem no site)</h3>
        <div className="filtros">{T("car_codigo", "Código do CAR")}{T("municipio", "Município")}{T("uf", "UF", { maxLength: 2 })}{T("latitude", "Latitude")}{T("longitude", "Longitude")}</div>
        <label htmlFor="gj">Polígono (GeoJSON) — {f.geojson ? "já cadastrado; cole outro para substituir" : "não cadastrado"}</label>
        <textarea id="gj" rows={3} placeholder='{"type":"Polygon","coordinates":[[[-43.1,-16.9],...]]}' value={v.geojson_novo} onChange={set("geojson_novo")} />
        <p className="suave pequeno">Use quando a fazenda não tem CAR. Só Polygon/MultiPolygon. Nunca aparece no site; a silhueta, se ligada, é redesenhada sem escala nem localização.</p>
        {f.geojson && <button type="button" className="btn sec" onClick={async () => { if (await confirmar({ titulo: "Remover o polígono?", texto: "A silhueta deixa de aparecer no site. Você poderá colar outro polígono depois.", confirmar: "Remover polígono", perigo: true })) void acao(() => api.put(`/api/admin/fazendas/${id}`, { geojson: null, mostrar_mapa: false }), "Polígono removido."); }}>Remover polígono</button>}
        <label htmlFor="nt">Notas internas</label><textarea id="nt" rows={3} value={v.notas_internas} onChange={set("notas_internas")} />
        <div className="salvar-barra">
          <button className="btn" type="submit" disabled={!sujo}>Salvar alterações</button>
          {sujo && <button type="button" className="btn sec" onClick={descartar}>Descartar alterações</button>}
          <span className="suave pequeno" role="status">{sujo ? "Há alterações não salvas." : "Tudo salvo."}</span>
        </div>
      </form>
      <div className="painel">
        <h3>Texto por IA</h3>
        <p className="suave pequeno">Gera uma sugestão a partir dos dados já públicos. Nada é salvo sozinho: revise e copie para a descrição.</p>
        <label htmlFor="obs">Observações para a IA (opcional)</label><textarea id="obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        <button className="btn sec" disabled={iaBusy} onClick={sugerir}>{iaBusy ? "Gerando…" : "Sugerir texto"}</button>
        <Erro erro={erroIA} />
        {sug && <><textarea rows={8} readOnly value={sug} /><button className="btn sec" onClick={() => setV({ ...v, descricao_publica: sug })}>Usar como descrição (revise e salve)</button></>}
      </div>
    </>
  );
}

const dataHora = (iso?: string) => { const t = iso ? new Date(iso) : null; return t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString("pt-BR") : null; };

function Atributos({ d, acao, id, confirmar }: { d: any; acao: any; id: string; confirmar: Confirmar }) {
  const [res, setRes] = useState<any>(null);
  const porChave: Record<string, any> = Object.fromEntries(d.atributos.map((a: any) => [a.chave, a]));
  const oficiais = d.atributos_catalogo.filter((x: any) => x.grupo === "oficial");
  const doCorretor = d.atributos_catalogo.filter((x: any) => x.grupo !== "oficial");
  const ultima = d.atributos.filter((a: any) => a.origem === "oficial").map((a: any) => a.consultado_em).sort().pop();
  const resumo = res?.resultado ? Object.entries(res.resultado).filter(([k]) => k !== "aviso_poligono").length : 0;
  return (
    <>
      <div className="painel">
        <h3>Dados oficiais</h3>
        <p className="suave pequeno">Vêm de bases públicas (SICAR, IBGE, FUNAI, ICMBio) e aparecem no site na aba “Informações governamentais”, com a fonte e a data. Nada é publicado sozinho: você escolhe o que mostrar. Leitura automática nunca vira “confirmado”; só você confirma, com vendedor, documento ou visita.</p>
        {!d.fazenda.car_codigo && <Aviso>Informe o CAR na aba Dados para poder atualizar.</Aviso>}
        <div className="linha">
          <button className="btn" disabled={!d.fazenda.car_codigo} onClick={() => acao(async () => setRes(await api.post(`/api/admin/fazendas/${id}/enriquecer`)), "Dados oficiais atualizados.")}>Atualizar dados oficiais</button>
          <span className="suave pequeno">{dataHora(ultima) ? `Última atualização: ${dataHora(ultima)}` : "Ainda não atualizado."}</span>
        </div>
        {res?.resultado?.aviso_poligono && <Aviso>Esta fazenda ainda não tem o desenho do imóvel: sobreposições e logística não foram consultadas.</Aviso>}
        {res && resumo > 0 && <p className="suave pequeno">{resumo} itens consultados. Itens sem resposta da fonte ficam como “sem dado” (isso não significa que não existam).</p>}
      </div>
      {oficiais.map((def: any) => <LinhaAtributo key={def.chave} def={def} a={porChave[def.chave]} acao={acao} id={id} confirmar={confirmar} />)}
      <div className="painel">
        <h3>Informado por você (corretor)</h3>
        <p className="suave pequeno">Dados que não estão em bases do governo, como poço artesiano, benfeitorias e documentação. Aparecem no site na aba “Informações do imóvel”.</p>
      </div>
      {doCorretor.map((def: any) => <LinhaAtributo key={def.chave} def={def} a={porChave[def.chave]} acao={acao} id={id} confirmar={confirmar} />)}
    </>
  );
}

function LinhaAtributo({ def, a, acao, id, confirmar }: { def: any; a: any; acao: any; id: string; confirmar: Confirmar }) {
  const valorAtual = a?.valor_json ?? "";
  const [achado, setAchado] = useState(a?.achado === "nao_detectado" ? "nao_detectado" : "detectado");
  const [valor, setValor] = useState(String(valorAtual));
  const [por, setPor] = useState("");
  const [obs, setObs] = useState(a?.observacao ?? "");
  const salvar = () => acao(() => api.put(`/api/admin/fazendas/${id}/atributos/${def.chave}`, {
    achado, valor: achado === "detectado" ? (def.tipo === "numero" ? Number(valor.replace(",", ".")) : valor) : undefined,
    confirmado_por: por || undefined, observacao: obs || undefined, publico: a?.publico && def.publicavel ? true : false,
  }));
  return (
    <div className="painel">
      <div className="linha">
        <strong>{def.rotulo}{def.unidade ? ` (${def.unidade})` : ""}</strong>
        {a && <span className={`selo ${a.estado}`}>{ESTADO_ROTULO[a.estado]}{a.achado === "nao_detectado" ? " · não detectado" : ""}</span>}
        <span className="espaco" />
        {a && def.publicavel && a.estado !== "sem_dado" && (
          <label className="interruptor" title="Mostrar no site">
            <input type="checkbox" checked={!!a.publico} onChange={(e) => acao(() => api.put(`/api/admin/fazendas/${id}/atributos/${def.chave}/publico`, { publico: e.target.checked }))} />
            <span className="chave" /> Público
          </label>
        )}
        {!def.publicavel && <span className="etiqueta">nunca público</span>}
      </div>
      {a?.fonte && <p className="suave pequeno">Fonte: {a.fonte}{dataHora(a.consultado_em) ? ` · ${dataHora(a.consultado_em)}` : ""}{a.observacao ? ` — ${a.observacao}` : ""}</p>}
      <div className="filtros">
        <Campo rotulo="Achado"><select value={achado} onChange={(e) => setAchado(e.target.value)}><option value="detectado">Informar valor</option><option value="nao_detectado">Não detectado</option></select></Campo>
        {achado === "detectado" && <Campo rotulo="Valor"><input value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>}
        <Campo rotulo="Confirmado por"><select value={por} onChange={(e) => setPor(e.target.value)}><option value="">Ninguém (apenas indicado)</option><option value="vendedor">Vendedor</option><option value="documento">Documento</option><option value="visita">Visita</option></select></Campo>
        <Campo rotulo="Observação"><input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        <button className="btn sec" onClick={salvar}>Salvar {def.rotulo.toLowerCase()}</button>
        {a && <button className="btn sec" onClick={async () => { if (await confirmar({ titulo: `Remover "${def.rotulo}"?`, texto: "O dado deixa de existir neste cadastro e, se era público, some do site.", confirmar: "Remover", perigo: true })) void acao(() => api.del(`/api/admin/fazendas/${id}/atributos/${def.chave}`), "Removido."); }}>Remover</button>}
      </div>
    </div>
  );
}

function Fotos({ d, acao, id, confirmar }: { d: any; acao: any; id: string; confirmar: Confirmar }) {
  return (
    <div className="painel">
      <h3>Fotos</h3>
      <p className="suave pequeno">JPEG ou PNG. Os dados de localização (GPS) das fotos são removidos automaticamente.</p>
      <input type="file" aria-label="Enviar fotos" accept="image/jpeg,image/png" multiple onChange={async (e) => {
        const arqs = Array.from(e.target.files ?? []); e.target.value = "";
        for (const a of arqs) await acao(() => api.upload(`/api/admin/fazendas/${id}/fotos`, a), "Foto enviada.");
      }} />
      <div className="fotos-admin">
        {d.fotos.map((p: any) => (
          <div key={p.id}>
            <img src={`/uploads/${p.arquivo}`} alt={p.legenda ?? "Foto"} />
            <input aria-label={`Legenda da foto ${p.ordem ?? ""}`.trim()} defaultValue={p.legenda ?? ""} placeholder="Legenda (salva ao sair do campo)" onBlur={(e) => { if (e.target.value !== (p.legenda ?? "")) void acao(() => api.put(`/api/admin/fotos/${p.id}`, { legenda: e.target.value }), "Legenda salva."); }} />
            <div className="linha">
              {p.capa ? <span className="etiqueta">Capa</span> : <button className="btn sec" onClick={() => acao(() => api.put(`/api/admin/fotos/${p.id}`, { capa: true }))}>Tornar capa</button>}
              <button className="btn sec" onClick={async () => { if (await confirmar({ titulo: "Remover esta foto?", texto: p.capa ? "É a foto de capa. Outra foto passará a ser a capa." : "A foto será apagada do anúncio.", confirmar: "Remover foto", perigo: true })) void acao(() => api.del(`/api/admin/fotos/${p.id}`), "Foto removida."); }}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Publicar({ d, acao, id, confirmar }: { d: any; acao: any; id: string; confirmar: Confirmar }) {
  const f = d.fazenda;
  const TEXTOS: Record<string, { titulo: string; texto: string; botao: string }> = {
    rascunho: { titulo: "Despublicar este anúncio?", texto: "Ele sai do site e do mapa do site (sitemap) imediatamente. Os dados ficam salvos como rascunho.", botao: "Despublicar" },
    vendida: { titulo: "Marcar como vendida?", texto: "O anúncio deixa de aparecer como disponível no site.", botao: "Marcar vendida" },
    arquivada: { titulo: "Arquivar este anúncio?", texto: "Ele sai do site. Você poderá reabri-lo depois, como rascunho.", botao: "Arquivar" },
  };
  const mudar = async (status: string) => {
    const t = TEXTOS[status];
    if (t && !(await confirmar({ titulo: t.titulo, texto: t.texto, confirmar: t.botao, perigo: status !== "rascunho" }))) return;
    void acao(() => api.post(`/api/admin/fazendas/${id}/status`, { status }), "Status atualizado.");
  };
  return (
    <>
      <div className="painel">
        <h3>Verificação antes de publicar</h3>
        {d.problemas_publicacao.length === 0 ? <Ok>Tudo certo para publicar.</Ok> : <ul>{d.problemas_publicacao.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>}
        <div className="linha">
          {f.status !== "publicada" && <button className="btn" onClick={() => mudar("publicada")}>Publicar</button>}
          {f.status === "publicada" && <><button className="btn sec" onClick={() => mudar("rascunho")}>Despublicar</button><button className="btn sec" onClick={() => mudar("vendida")}>Marcar vendida</button><Link to={`/fazenda/${f.slug}`}>Ver no site</Link></>}
          {f.status !== "arquivada" && <button className="btn sec" onClick={() => mudar("arquivada")}>Arquivar</button>}
        </div>
      </div>
      <div className="painel">
        <h3>Prévia dos dados públicos</h3>
        {d.previa_publica.length === 0 ? <p className="suave">Nenhum dado da terra marcado como público.</p> :
          <ul>{d.previa_publica.map((a: any) => <li key={a.chave}>{a.rotulo}: <strong>{a.texto}</strong> ({a.confianca})</li>)}</ul>}
      </div>
    </>
  );
}
