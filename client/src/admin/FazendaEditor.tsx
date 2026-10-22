import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Erro, Ok, Aviso } from "../components/Avisos";

type Aba = "dados" | "atributos" | "fotos" | "publicar";
const ESTADO_ROTULO: Record<string, string> = { confirmado: "Confirmado", indicado: "Indicado por fonte", sem_dado: "Sem dado" };

export default function FazendaEditor() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [aba, setAba] = useState<Aba>("dados");
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const carregar = useCallback(async () => { try { setD(await api.get(`/api/admin/fazendas/${id}`)); } catch (x) { setErro(x); } }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  const acao = async (fn: () => Promise<unknown>, msg = "Salvo.") => {
    setErro(null); setOk("");
    try { await fn(); setOk(msg); await carregar(); } catch (x) { setErro(x); await carregar(); }
  };
  if (!d) return <><Erro erro={erro} /><p className="suave">Carregando…</p></>;
  const f = d.fazenda;
  return (
    <>
      <p><Link to="/admin">← Fazendas</Link></p>
      <h1>{f.titulo} <span className="etiqueta">{f.status}</span></h1>
      <div className="abas">{(["dados", "atributos", "fotos", "publicar"] as Aba[]).map((a) => (
        <button key={a} className={aba === a ? "ativa" : ""} onClick={() => setAba(a)}>{{ dados: "Dados", atributos: "Dados da terra", fotos: "Fotos", publicar: "Publicação" }[a]}</button>))}</div>
      <Erro erro={erro} />{ok && <Ok>{ok}</Ok>}
      {aba === "dados" && <Dados key={String(f.atualizado_em)} f={f} acao={acao} id={id!} />}
      {aba === "atributos" && <Atributos d={d} acao={acao} id={id!} />}
      {aba === "fotos" && <Fotos d={d} acao={acao} id={id!} />}
      {aba === "publicar" && <Publicar d={d} acao={acao} id={id!} />}
    </>
  );
}

function Dados({ f, acao, id }: { f: any; acao: any; id: string }) {
  const [v, setV] = useState({
    titulo: f.titulo ?? "", regiao_publica: f.regiao_publica ?? "", culturas: (f.culturas ?? []).join(", "), area_ha: f.area_ha ?? "",
    area_exibicao: f.area_exibicao, preco_exibicao: f.preco_exibicao ?? "", descricao_publica: f.descricao_publica ?? "",
    destaque: f.destaque, destaque_ordem: f.destaque_ordem ?? 0, mostrar_mapa: f.mostrar_mapa, mostrar_regiao: f.mostrar_regiao, geojson_novo: "", whatsapp_proprio: f.whatsapp_proprio ?? "",
    car_codigo: f.car_codigo ?? "", municipio: f.municipio ?? "", uf: f.uf ?? "", latitude: f.latitude ?? "", longitude: f.longitude ?? "", notas_internas: f.notas_internas ?? "",
  });
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
        {f.geojson && <button type="button" className="btn sec" onClick={() => acao(() => api.put(`/api/admin/fazendas/${id}`, { geojson: null, mostrar_mapa: false }), "Polígono removido.")}>Remover polígono</button>}
        <label htmlFor="nt">Notas internas</label><textarea id="nt" rows={3} value={v.notas_internas} onChange={set("notas_internas")} />
        <button className="btn" type="submit">Salvar</button>
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

function Atributos({ d, acao, id }: { d: any; acao: any; id: string }) {
  const [res, setRes] = useState<any>(null);
  const porChave: Record<string, any> = Object.fromEntries(d.atributos.map((a: any) => [a.chave, a]));
  return (
    <>
      <div className="painel">
        <h3>Enriquecer pelo CAR</h3>
        <p className="suave pequeno">Busca altitude e argila na base da Hub. Resultado automático nunca vira “confirmado”: só você confirma, com vendedor, documento ou visita.</p>
        {!d.fazenda.car_codigo && <Aviso>Informe o CAR na aba Dados, ou preencha manualmente abaixo.</Aviso>}
        <button className="btn" disabled={!d.fazenda.car_codigo} onClick={() => acao(async () => setRes(await api.post(`/api/admin/fazendas/${id}/enriquecer`)), "Consulta feita.")}>Buscar dados da Hub</button>
        {res && <pre className="pequeno">{JSON.stringify(res.resultado, null, 1)}</pre>}
      </div>
      {d.atributos_catalogo.map((def: any) => <LinhaAtributo key={def.chave} def={def} a={porChave[def.chave]} acao={acao} id={id} />)}
    </>
  );
}

function LinhaAtributo({ def, a, acao, id }: { def: any; a: any; acao: any; id: string }) {
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
      {a?.fonte && <p className="suave pequeno">Fonte: {a.fonte}{a.observacao ? ` — ${a.observacao}` : ""}</p>}
      <div className="filtros">
        <div><label>Achado</label><select value={achado} onChange={(e) => setAchado(e.target.value)}><option value="detectado">Informar valor</option><option value="nao_detectado">Não detectado</option></select></div>
        {achado === "detectado" && <div><label>Valor</label><input value={valor} onChange={(e) => setValor(e.target.value)} /></div>}
        <div><label>Confirmado por</label><select value={por} onChange={(e) => setPor(e.target.value)}><option value="">Ninguém (apenas indicado)</option><option value="vendedor">Vendedor</option><option value="documento">Documento</option><option value="visita">Visita</option></select></div>
        <div><label>Observação</label><input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <button className="btn sec" onClick={salvar}>Salvar</button>
        {a && <button className="btn sec" onClick={() => acao(() => api.del(`/api/admin/fazendas/${id}/atributos/${def.chave}`), "Removido.")}>Remover</button>}
      </div>
    </div>
  );
}

function Fotos({ d, acao, id }: { d: any; acao: any; id: string }) {
  return (
    <div className="painel">
      <h3>Fotos</h3>
      <p className="suave pequeno">JPEG ou PNG. Os dados de localização (GPS) das fotos são removidos automaticamente.</p>
      <input type="file" accept="image/jpeg,image/png" multiple onChange={async (e) => {
        const arqs = Array.from(e.target.files ?? []); e.target.value = "";
        for (const a of arqs) await acao(() => api.upload(`/api/admin/fazendas/${id}/fotos`, a), "Foto enviada.");
      }} />
      <div className="fotos-admin">
        {d.fotos.map((p: any) => (
          <div key={p.id}>
            <img src={`/uploads/${p.arquivo}`} alt={p.legenda ?? "Foto"} />
            <input defaultValue={p.legenda ?? ""} placeholder="Legenda" onBlur={(e) => { if (e.target.value !== (p.legenda ?? "")) void acao(() => api.put(`/api/admin/fotos/${p.id}`, { legenda: e.target.value })); }} />
            <div className="linha">
              {p.capa ? <span className="etiqueta">Capa</span> : <button className="btn sec" onClick={() => acao(() => api.put(`/api/admin/fotos/${p.id}`, { capa: true }))}>Tornar capa</button>}
              <button className="btn sec" onClick={() => acao(() => api.del(`/api/admin/fotos/${p.id}`), "Foto removida.")}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Publicar({ d, acao, id }: { d: any; acao: any; id: string }) {
  const f = d.fazenda;
  const mudar = (status: string) => acao(() => api.post(`/api/admin/fazendas/${id}/status`, { status }), "Status atualizado.");
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
