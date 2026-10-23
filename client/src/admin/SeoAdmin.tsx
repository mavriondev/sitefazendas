import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Erro, Ok } from "../components/Avisos";
import { PAGINAS_SEO, paginaSeoVazia, seoPadrao } from "../../../shared/seo";
import type { ConfigSeo, PaginaSeo } from "../../../shared/seo";
import "./SeoAdmin.css";

interface Midia { arquivo: string; url: string; publicado: boolean }
interface FazendaItem { slug: string; titulo: string; status?: string }

const CHAVE = "gramogol:seo:rascunho:v1";
const IMG_PADRAO = "/images/gramogol/fazenda-aerea.jpg";
const L = { titulo: 160, descricao: 320, base: 200, imagem: 250, ver: 200 };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const completar = (c: any): ConfigSeo => ({ ...seoPadrao(), ...c, paginas: { ...(c?.paginas ?? {}) } });
const lerRascunho = (): ConfigSeo | null => {
  try { const t = sessionStorage.getItem(CHAVE); if (!t) return null; const j = JSON.parse(t); return j && typeof j === "object" && j.paginas ? completar(j) : null; } catch { return null; }
};
const gravarRascunho = (c: ConfigSeo | null) => {
  try { if (c) sessionStorage.setItem(CHAVE, JSON.stringify(c)); else sessionStorage.removeItem(CHAVE); } catch { /* indisponível */ }
};
const sem = (c: ConfigSeo) => JSON.stringify({ ...c, revisao: 0 });
const urlBaseValida = (u: string) => { if (!u) return true; try { const o = new URL(u); return o.protocol === "https:" && o.origin === u.replace(/\/$/,""); } catch { return false; } };
const codigoValido = (v: string) => /^[A-Za-z0-9_-]*$/.test(v);

function Contador({ n, max, ideal }: { n: number; max: number; ideal?: [number, number] }) {
  let cls = "";
  if (ideal && n > 0) cls = n >= ideal[0] && n <= ideal[1] ? "seo-ok" : "seo-med";
  if (n >= max) cls = "seo-ruim";
  return <span className={cls}>{n}/{max}{ideal && <> (sugestão: {ideal[0]} a {ideal[1]})</>}</span>;
}

function Campo({ id, rotulo, valor, max, ideal, onChange, area, placeholder, dica, erro }: {
  id: string; rotulo: string; valor: string; max: number; ideal?: [number, number]; onChange: (v: string) => void; area?: boolean; placeholder?: string; dica?: string; erro?: string;
}) {
  return (
    <div className="seo-campo">
      <label htmlFor={id}><strong>{rotulo}</strong></label>
      {area ? <textarea id={id} rows={3} maxLength={max} value={valor} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        : <input id={id} type="text" maxLength={max} value={valor} placeholder={placeholder} onChange={e => onChange(e.target.value)} />}
      <div className="seo-meta"><span className="suave pequeno">{dica}</span><Contador n={valor.length} max={max} ideal={ideal} /></div>
      {erro && <span className="seo-ruim pequeno" role="alert">{erro}</span>}
    </div>
  );
}

function CampoImagem({ valor, herdada, rotuloHerdada, abrir, onChange }: { valor: string; herdada?: string; rotuloHerdada: string; abrir: () => void; onChange: (v: string) => void }) {
  const mostrar = valor || herdada || "";
  return (
    <div className="seo-img">
      {mostrar ? <img src={mostrar} alt="Prévia da imagem de compartilhamento" /> : <div className="vz" role="img" aria-label="Sem imagem" />}
      <div className="ac">
        <span className="pequeno suave">{valor ? <code style={{ wordBreak: "break-all" }}>{valor}</code> : herdada ? `Usando: ${rotuloHerdada}` : "Sem imagem definida: o site usa a capa da fazenda ou a imagem editorial padrão."}</span>
        <button type="button" className="btn mini sec" onClick={abrir}>Escolher ou enviar imagem</button>
        <button type="button" className="btn mini sec" disabled={!valor} onClick={() => onChange("")}>Remover imagem</button>
      </div>
    </div>
  );
}

export default function SeoAdmin() {
  const [servidor, setServidor] = useState<ConfigSeo | null>(null);
  const [rascunho, setRascunho] = useState<ConfigSeo | null>(null);
  const [fazendas, setFazendas] = useState<FazendaItem[]>([]);
  const [erroCarga, setErroCarga] = useState<unknown>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState("");
  const [conflito, setConflito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [alvo, setAlvo] = useState("global");
  const [pendente, setPendente] = useState<ConfigSeo | null>(null);
  const [seletor, setSeletor] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErroCarga(null);
    try {
      const [c, f] = await Promise.all([
        api.get<ConfigSeo>("/api/admin/seo"),
        api.get<{ fazendas: FazendaItem[] }>("/api/admin/seo/fazendas"),
      ]);
      const s = completar(c);
      setServidor(s); setRascunho(clone(s)); setFazendas(f.fazendas ?? []); setConflito(false);
      const g = lerRascunho();
      setPendente(g && sem(g) !== sem(s) ? g : null);
      if (!g) gravarRascunho(null);
    } catch (x) { setErroCarga(x); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const sujo = useMemo(() => !!servidor && !!rascunho && sem(servidor) !== sem(rascunho), [servidor, rascunho]);

  useEffect(() => { if (!servidor || pendente) return; gravarRascunho(sujo ? rascunho : null); }, [sujo, rascunho, servidor, pendente]);

  useEffect(() => {
    if (!sujo) return;
    const antes = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const clique = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== location.origin || e.defaultPrevented) return;
      if (!window.confirm("Há alterações não salvas. Sair desta tela e perder o rascunho?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", antes);
    document.addEventListener("click", clique, true);
    return () => { window.removeEventListener("beforeunload", antes); document.removeEventListener("click", clique, true); };
  }, [sujo]);

  const ehGlobal = alvo === "global";
  const pag: PaginaSeo = rascunho ? (ehGlobal ? paginaSeoVazia() : rascunho.paginas[alvo] ?? paginaSeoVazia()) : paginaSeoVazia();

  const mudar = (fn: (c: ConfigSeo) => void) => { setRascunho(r => { if (!r) return r; const n = clone(r); fn(n); return n; }); setOk(""); };
  const mudarPag = (campo: keyof PaginaSeo, v: string | boolean) => mudar(c => {
    const p = { ...paginaSeoVazia(), ...(c.paginas[alvo] ?? {}) } as any; p[campo] = v;
    const vazia = !p.titulo && !p.descricao && !p.imagem && !p.nao_indexar;
    if (vazia) delete c.paginas[alvo]; else c.paginas[alvo] = p;
  });
  const alterada = (chave: string) => !!servidor && JSON.stringify(servidor.paginas[chave] ?? null) !== JSON.stringify(rascunho?.paginas[chave] ?? null);

  const salvar = async () => {
    if (!rascunho || !servidor) return;
    if (!urlBaseValida(rascunho.url_base)) return setErro({ message: "Endereço do site inválido. Use apenas a origem HTTPS, como https://seudominio.com.br, sem barra final ou caminho." });
    if (!codigoValido(rascunho.google_verificacao) || !codigoValido(rascunho.bing_verificacao)) return setErro({ message: "Os códigos de verificação aceitam apenas letras, números, hífen e sublinhado." });
    if (rascunho.bloquear_indexacao && !servidor.bloquear_indexacao &&
      !window.confirm("ATENÇÃO: você vai publicar o bloqueio de TODO o site para buscadores. As fazendas deixarão de aparecer no Google e no Bing com o tempo. Confirma?")) return;
    setSalvando(true); setErro(null); setOk(""); setConflito(false);
    try {
      const salvo = completar(await api.put<ConfigSeo>("/api/admin/seo", rascunho));
      setServidor(salvo); setRascunho(clone(salvo)); setOk("Configurações de SEO salvas e publicadas.");
    } catch (x: any) {
      if (x?.status === 409) setConflito(true); else setErro(x);
    } finally { setSalvando(false); }
  };
  const descartar = () => {
    if (!servidor || !window.confirm("Descartar todas as alterações não salvas do site inteiro?")) return;
    setRascunho(clone(servidor)); setOk(""); setErro(null); gravarRascunho(null);
  };
  const redefinirPagina = () => {
    if (ehGlobal) return;
    mudar(c => { delete c.paginas[alvo]; });
  };
  const nomeAlvo = ehGlobal ? "Configurações gerais" : alvo.startsWith("/fazenda/") ? (fazendas.find(f => "/fazenda/" + f.slug === alvo)?.titulo ?? alvo) : (PAGINAS_SEO.find(p => p.caminho === alvo)?.nome ?? alvo);

  if (erroCarga) return <><h1>SEO e buscadores</h1><Erro erro={erroCarga} /><button className="btn" onClick={() => void carregar()}>Tentar novamente</button></>;
  if (!rascunho || !servidor) return <><h1>SEO e buscadores</h1><div className="seo-esq" aria-busy="true" aria-label="Carregando"><div /><div /><div /></div></>;

  const base = rascunho.url_base.replace(/\/+$/,"");
  const baseErro = urlBaseValida(rascunho.url_base) ? undefined : "Use somente a origem HTTPS, ex.: https://seudominio.com.br, sem caminhos ou parâmetros.";
  const tituloEf = (ehGlobal ? rascunho.titulo_padrao : pag.titulo || rascunho.titulo_padrao) || "";
  const descEf = (ehGlobal ? rascunho.descricao_padrao : pag.descricao || rascunho.descricao_padrao) || "";
  const imgEf = (ehGlobal ? rascunho.imagem_padrao : pag.imagem || rascunho.imagem_padrao) || "";
  const caminho = ehGlobal ? "/" : alvo;
  const urlPrev = base ? base + (caminho === "/" ? "" : caminho) : "seudominio.com.br" + (caminho === "/" ? "" : caminho);

  return (
    <>
      <h1>SEO e buscadores</h1>
      <p className="suave">Controle como cada página aparece no Google, Bing e ao compartilhar links. Campos vazios usam automaticamente o texto padrão e, na falta dele, o conteúdo da própria página. As sugestões de tamanho ajudam a evitar cortes, mas não garantem posição nos resultados.</p>
      <div className="seo-barra">
        <button className="btn" onClick={() => void salvar()} disabled={!sujo || salvando} aria-busy={salvando}>{salvando ? "Salvando..." : "Salvar alterações"}</button>
        <button className="btn sec" onClick={descartar} disabled={!sujo || salvando}>Descartar alterações</button>
        <span className="suave pequeno" role="status">{sujo ? "Alterações não salvas" : `Revisão ${servidor.revisao}`}</span>
      </div>
      {pendente && (
        <div className="msg aviso" role="alert">
          Há um rascunho de SEO não salvo guardado neste navegador. Deseja restaurá-lo?
          <div className="linha" style={{ marginTop: 8 }}>
            <button className="btn mini" onClick={() => { setRascunho(clone(pendente)); setPendente(null); }}>Restaurar rascunho</button>
            <button className="btn mini sec" onClick={() => { if (window.confirm("Descartar o rascunho guardado neste navegador?")) { gravarRascunho(null); setPendente(null); } }}>Descartar rascunho</button>
          </div>
        </div>
      )}
      <Erro erro={erro} />
      {ok && <Ok>{ok}</Ok>}
      {conflito && (
        <div className="msg erro" role="alert">
          Outra pessoa salvou o SEO antes de você. Seu rascunho continua aqui e nada foi perdido. Use "Recarregar versão do servidor" para continuar da versão mais recente (o rascunho atual será substituído).
          <div className="linha" style={{ marginTop: 8 }}>
            <button className="btn mini" onClick={() => { if (window.confirm("Substituir o rascunho pela versão do servidor?")) void carregar(); }}>Recarregar versão do servidor</button>
            <button className="btn mini sec" onClick={() => setConflito(false)}>Manter rascunho</button>
          </div>
        </div>
      )}

      <fieldset className="seo-wrap" disabled={salvando} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <nav className="seo-lista" aria-label="Páginas">
          <button type="button" aria-current={ehGlobal} onClick={() => setAlvo("global")}><span>Geral do site</span>{servidor && sem({ ...servidor, paginas: {} }) !== sem({ ...rascunho, paginas: {} }) && <span className="seo-ponto" aria-label="Alterada" />}</button>
          <h3>Páginas</h3>
          {PAGINAS_SEO.map(p => (
            <button type="button" key={p.caminho} aria-current={alvo === p.caminho} onClick={() => setAlvo(p.caminho)}><span>{p.nome}</span>{alterada(p.caminho) && <span className="seo-ponto" aria-label="Alterada" />}</button>
          ))}
          <h3>Fazendas</h3>
          <p className="suave pequeno">Inclui rascunhos. Somente imóveis publicados podem aparecer nos buscadores.</p>
          {fazendas.length === 0 && <span className="suave pequeno">Nenhuma fazenda cadastrada.</span>}
          {fazendas.map(f => {
            const k = "/fazenda/" + f.slug;
            return <button type="button" key={f.slug} aria-current={alvo === k} onClick={() => setAlvo(k)}><span>{f.titulo}</span>{alterada(k) && <span className="seo-ponto" aria-label="Alterada" />}</button>;
          })}
        </nav>

        <div>
          <h2 style={{ marginTop: 0 }}>{nomeAlvo}</h2>

          {ehGlobal && (
            <>
              <section className="seo-card">
                <h3>Endereço do site</h3>
                <Campo id="seo-base" rotulo="Endereço principal (HTTPS)" valor={rascunho.url_base} max={L.base} onChange={v => mudar(c => { c.url_base = v.trim(); })} placeholder="https://seudominio.com.br" erro={baseErro}
                  dica="Informe só a origem, definida por você. Usado em links canônicos, sitemap e robots. Deixe vazio até confirmar o domínio." />
                {base && !baseErro ? (
                  <p className="pequeno">Conferir: <a href={base + "/sitemap.xml"} target="_blank" rel="noreferrer">sitemap.xml</a> | <a href={base + "/robots.txt"} target="_blank" rel="noreferrer">robots.txt</a> (abrem em nova aba; só funcionam depois de publicado nesse endereço).</p>
                ) : <p className="pequeno suave">Links do sitemap e do robots aparecem quando o endereço estiver definido.</p>}
              </section>

              <section className="seo-card">
                <h3>Textos e imagem padrão</h3>
                <p className="suave pequeno">Usados por páginas que não tiverem os próprios.</p>
                <Campo id="seo-tp" rotulo="Título padrão" valor={rascunho.titulo_padrao} max={L.titulo} ideal={[30, 60]} onChange={v => mudar(c => { c.titulo_padrao = v; })} dica="Texto simples. Vazio: o site monta o título automaticamente." />
                <Campo id="seo-dp" rotulo="Descrição padrão" valor={rascunho.descricao_padrao} max={L.descricao} ideal={[70, 160]} area onChange={v => mudar(c => { c.descricao_padrao = v; })} dica="Resumo claro do que a pessoa encontra. Vazio: usa o texto da página." />
                <strong>Imagem de compartilhamento padrão</strong>
                <CampoImagem valor={rascunho.imagem_padrao} rotuloHerdada="" abrir={() => setSeletor("global")} onChange={v => mudar(c => { c.imagem_padrao = v; })} />
                <p className="suave pequeno">Opcional. Sugestão: JPEG ou PNG horizontal, proporção próxima de 1,91:1 (ex.: 1200 x 630).</p>
              </section>

              <section className="seo-card">
                <h3>Verificação nos buscadores</h3>
                <p className="suave pequeno">Cole apenas o código de verificação (o valor de content), nunca a tag HTML nem scripts.</p>
                <Campo id="seo-gv" rotulo="Google Search Console" valor={rascunho.google_verificacao} max={L.ver} onChange={v => mudar(c => { c.google_verificacao = v.trim(); })} erro={codigoValido(rascunho.google_verificacao) ? undefined : "Use apenas letras, números, hífen e sublinhado."} />
                <Campo id="seo-bv" rotulo="Bing Webmaster Tools" valor={rascunho.bing_verificacao} max={L.ver} onChange={v => mudar(c => { c.bing_verificacao = v.trim(); })} erro={codigoValido(rascunho.bing_verificacao) ? undefined : "Use apenas letras, números, hífen e sublinhado."} />
              </section>

              <section className={`seo-card${rascunho.bloquear_indexacao ? " seo-aviso-bloq" : ""}`}>
                <h3>Bloquear indexação de todo o site</h3>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={rascunho.bloquear_indexacao} onChange={e => mudar(c => { c.bloquear_indexacao = e.target.checked; })} />
                  <span>Pedir aos buscadores que não indexem nenhuma página.</span>
                </label>
                <p className="pequeno" style={{ marginBottom: 0 }}><strong>Cuidado:</strong> com isso ligado, o site inteiro some dos resultados de busca com o tempo. Use apenas em fase de testes. Ao salvar, será pedida uma confirmação.</p>
              </section>
            </>
          )}

          {!ehGlobal && (
            <section className="seo-card">
              <h3>Textos desta página</h3>
              <Campo id="seo-t" rotulo="Título" valor={pag.titulo} max={L.titulo} ideal={[30, 60]} onChange={v => mudarPag("titulo", v)} placeholder={rascunho.titulo_padrao || "Automático"} dica="Vazio: usa o título padrão ou o gerado pelo site." />
              <Campo id="seo-d" rotulo="Descrição" valor={pag.descricao} max={L.descricao} ideal={[70, 160]} area onChange={v => mudarPag("descricao", v)} placeholder={rascunho.descricao_padrao || "Automática"} dica="Vazio: usa a descrição padrão ou o texto da página." />
              <strong>Imagem de compartilhamento</strong>
              <CampoImagem valor={pag.imagem} herdada={rascunho.imagem_padrao} rotuloHerdada="imagem padrão do site" abrir={() => setSeletor(alvo)} onChange={v => mudarPag("imagem", v)} />
              <p className="suave pequeno">Sem imagem aqui nem padrão, o site usa a capa da fazenda ou a imagem editorial padrão.</p>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12 }}>
                <input type="checkbox" checked={pag.nao_indexar} onChange={e => mudarPag("nao_indexar", e.target.checked)} />
                <span>Não indexar esta página (noindex). Ela continua acessível por link, mas buscadores são orientados a ignorá-la.</span>
              </label>
              <div className="seo-barra">
                <button type="button" className="btn mini sec" disabled={!alterada(alvo) && !rascunho.paginas[alvo]} onClick={redefinirPagina}>Limpar campos desta página</button>
                <span className="suave pequeno">Só afeta o rascunho desta página; use Descartar para voltar ao salvo.</span>
              </div>
            </section>
          )}

          <section className="seo-card">
            <h3>Prévia</h3>
            {!ehGlobal && pag.nao_indexar && <p className="seo-ruim pequeno">Esta página está marcada como noindex e não deve aparecer em buscas.</p>}
            {rascunho.bloquear_indexacao && <p className="seo-ruim pequeno">O bloqueio global está ligado: nenhuma página será indexada.</p>}
            <div className="seo-previa" aria-label="Prévia no Google">
              <div className="u">{urlPrev}</div>
              <div className="t">{tituloEf || "(título automático do site)"}</div>
              <div className="d">{descEf || "(descrição automática a partir do texto da página)"}</div>
            </div>
            <div className="seo-social" aria-label="Prévia ao compartilhar">
              {imgEf ? <img src={imgEf} alt="" /> : <div className="vz" />}
              <div className="tx"><strong>{tituloEf || "(título automático)"}</strong><div className="suave">{descEf || "(descrição automática)"}</div>{!imgEf && <div className="suave pequeno">Sem imagem definida: será usada a capa ou a imagem editorial.</div>}</div>
            </div>
          </section>
        </div>
      </fieldset>

      {seletor && <Biblioteca
        atual={seletor === "global" ? rascunho.imagem_padrao : rascunho.paginas[seletor]?.imagem ?? ""}
        onEscolher={url => {
          const k = seletor;
          mudar(c => {
            if (k === "global") { c.imagem_padrao = url; return; }
            const p = { ...paginaSeoVazia(), ...(c.paginas[k] ?? {}) }; p.imagem = url; c.paginas[k] = p;
          });
          setSeletor(null);
        }}
        onFechar={() => setSeletor(null)} />}
    </>
  );
}

function Biblioteca({ atual, onEscolher, onFechar }: { atual: string; onEscolher: (u: string) => void; onFechar: () => void }) {
  const [lista, setLista] = useState<Midia[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const [apagando, setApagando] = useState("");
  const [info, setInfo] = useState("");
  const [padraoOk, setPadraoOk] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try { setLista((await api.get<{ midias: Midia[] }>("/api/admin/seo/midias")).midias); } catch (x) { setErro(x); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    let vivo = true;
    fetch(IMG_PADRAO, { method: "HEAD" }).then(r => { if (vivo && r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) setPadraoOk(true); }).catch(() => { /* ausente */ });
    return () => { vivo = false; };
  }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onFechar]);

  const enviar = async (f: File | undefined) => {
    if (!f) return;
    setErro(null); setInfo("");
    if (!/^image\/(jpeg|png)$/.test(f.type)) return setErro({ message: "Use uma imagem JPEG ou PNG." });
    if (f.size > 12 * 1024 * 1024) return setErro({ message: "A imagem excede 12 MB." });
    setEnviando(true);
    try { const m = await api.upload<Midia>("/api/admin/seo/midias", f); onEscolher(m.url); } catch (x) { setErro(x); } finally { setEnviando(false); }
  };
  const apagar = async (m: Midia) => {
    if (!window.confirm("Excluir esta imagem da biblioteca de SEO? Só é possível se nenhuma configuração a usar.")) return;
    setApagando(m.arquivo); setErro(null); setInfo("");
    try { await api.del(`/api/admin/seo/midias/${encodeURIComponent(m.arquivo)}`); setInfo("Imagem excluída."); await carregar(); }
    catch (x: any) { setErro(x?.status === 409 ? { message: "Imagem em uso nas configurações de SEO; troque-a antes de excluir." } : x); }
    finally { setApagando(""); }
  };

  return (
    <div className="seo-modal" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="seo-bib-t">
        <div className="linha"><h2 id="seo-bib-t" style={{ margin: 0 }} className="espaco">Imagem de compartilhamento</h2><button className="btn mini sec" onClick={onFechar} autoFocus>Fechar</button></div>
        <p className="suave pequeno">Imagens enviadas ficam privadas até serem usadas em configurações de SEO salvas. Depois de escolher, clique em Salvar alterações.</p>
        <label className="btn" style={{ cursor: "pointer" }}>
          {enviando ? "Enviando..." : "Enviar nova imagem (JPEG ou PNG, até 12 MB)"}
          <input type="file" accept="image/jpeg,image/png" hidden disabled={enviando} onChange={e => { void enviar(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div style={{ marginTop: 10 }}><Erro erro={erro} />{info && <Ok>{info}</Ok>}</div>
        {padraoOk && <div className="seo-lib"><figure><img src={IMG_PADRAO} alt="Imagem aérea padrão do site" /><figcaption>Padrão do site</figcaption><button className="btn mini" onClick={() => onEscolher(IMG_PADRAO)}>{atual === IMG_PADRAO ? "Em uso" : "Usar"}</button></figure></div>}
        <h3>Biblioteca de SEO</h3>
        {!lista && !erro && <div className="seo-esq" aria-busy="true"><div /></div>}
        {!!erro && !lista && <button className="btn mini" onClick={() => void carregar()}>Tentar novamente</button>}
        {lista && lista.length === 0 && <p className="suave">Nenhuma imagem enviada ainda.</p>}
        <div className="seo-lib">
          {lista?.map(m => (
            <figure key={m.arquivo}>
              <img src={m.url} alt={`Imagem enviada ${m.arquivo}`} loading="lazy" />
              <figcaption>{m.arquivo}<br />{m.publicado ? "Referenciada no SEO salvo" : "Somente administradores"}</figcaption>
              <div className="linha">
                <button className="btn mini" onClick={() => onEscolher(m.url)}>{atual === m.url ? "Em uso" : "Usar"}</button>
                <button className="btn mini perigo" disabled={apagando === m.arquivo} onClick={() => void apagar(m)}>Excluir</button>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
