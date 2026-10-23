import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useSite } from "../contexto";
import { Erro, Ok, Aviso } from "../components/Avisos";
import { PAGINAS_CONTEUDO, completarConteudo } from "../../../shared/conteudo";
import type { CampoConteudo, ConteudoSite, PaginaRegistro } from "../../../shared/conteudo";
import "./ConteudoAdmin.css";

interface Midia { arquivo: string; url: string; publicado: boolean; criado_em: string }

const CHAVE = "gramogol:conteudo:rascunho:v1";
const lerRascunho = (): ConteudoSite | null => {
  try { const t = sessionStorage.getItem(CHAVE); if (!t) return null; const j = JSON.parse(t); return j && typeof j === "object" && j.paginas ? completarConteudo(j) : null; } catch { return null; }
};
const gravarRascunho = (c: ConteudoSite | null) => {
  try { if (c) sessionStorage.setItem(CHAVE, JSON.stringify({ revisao: c.revisao, paginas: c.paginas })); else sessionStorage.removeItem(CHAVE); } catch { /* armazenamento indisponível */ }
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const LINKS: Record<string, { to: string; texto: string }[]> = {
  global: [{ to: "/admin/config", texto: "Configurações (nome, contatos, CRECI)" }],
  home: [{ to: "/admin/slides", texto: "Slides da home" }, { to: "/admin/config", texto: "Configurações (Sobre e títulos alternativos)" }],
  sobre: [{ to: "/admin/config", texto: "Configurações (título e texto principal)" }],
  parceiros: [{ to: "/admin/parceiros", texto: "Parceiros" }],
  contato: [{ to: "/admin/config", texto: "Configurações (telefones, endereço, e-mail)" }],
  fazenda: [{ to: "/admin", texto: "Fazendas" }],
};

/** Grupo de ordenação: só se move dentro do mesmo grupo. null = fixo. */
function grupo(pagina: PaginaRegistro, id: string): string | null {
  if (pagina.id === "global") {
    if (id === "rodape_creditos") return null;
    if (id.startsWith("menu_")) return "menu";
    if (id.startsWith("rodape_")) return "rodape";
    return null;
  }
  return "todos";
}

/** Retorna mensagem de erro se a combinação for inválida. */
function validar(pagina: PaginaRegistro, ordem: string[], ocultas: string[]): string | null {
  if (pagina.id === "home") {
    const vis = ordem.filter(i => !ocultas.includes(i));
    const h = vis.indexOf("hero"), b = vis.indexOf("busca");
    if (h >= 0 && b >= 0 && b < h) return "A busca de fazendas deve ficar depois do slider enquanto os dois estiverem visíveis.";
  }
  return null;
}

function CampoImagem({ campo, valor, onChange, abrir }: { campo: CampoConteudo; valor: string; onChange: (v: string) => void; abrir: () => void }) {
  return (
    <div className="cd-img">
      {valor ? <img src={valor} alt={`Prévia: ${campo.rotulo}`} /> : <div role="img" aria-label="Sem imagem" style={{ width: 160, height: 100, background: "#e9e6d8", borderRadius: 8 }} />}
      <div className="acoes">
        <code className="pequeno" style={{ wordBreak: "break-all" }}>{valor || "(vazio)"}</code>
        <button type="button" className="btn mini sec" onClick={abrir}>Escolher ou enviar imagem</button>
        <button type="button" className="btn mini sec" onClick={() => onChange("")} disabled={!valor}>Remover imagem deste campo</button>
        <button type="button" className="btn mini sec" onClick={() => onChange(campo.padrao)} disabled={valor === campo.padrao}>Restaurar padrão</button>
      </div>
    </div>
  );
}

export default function ConteudoAdmin() {
  const { recarregar } = useSite();
  const [servidor, setServidor] = useState<ConteudoSite | null>(null);
  const [rascunho, setRascunho] = useState<ConteudoSite | null>(null);
  const [erroCarga, setErroCarga] = useState<unknown>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [aviso, setAviso] = useState("");
  const [ok, setOk] = useState("");
  const [conflito, setConflito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [paginaId, setPaginaId] = useState(PAGINAS_CONTEUDO[0].id);
  const [pendente, setPendente] = useState<ConteudoSite | null>(null);
  const [campoImg, setCampoImg] = useState<{ pagina: string; chave: string; campo: CampoConteudo } | null>(null);

  const carregar = useCallback(async () => {
    setErroCarga(null);
    try { const c = await api.get<ConteudoSite>("/api/admin/conteudo"); setServidor(c); setRascunho(clone(c)); setConflito(false);
      const g = lerRascunho();
      setPendente(g && JSON.stringify(g.paginas) !== JSON.stringify(c.paginas) ? g : null);
      if (!g) gravarRascunho(null);
    } catch (x) { setErroCarga(x); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const sujo = useMemo(() => !!servidor && !!rascunho && JSON.stringify(servidor.paginas) !== JSON.stringify(rascunho.paginas), [servidor, rascunho]);

  useEffect(() => {
    if (!servidor || pendente) return;
    gravarRascunho(sujo ? rascunho : null);
  }, [sujo, rascunho, servidor, pendente]);

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

  const pagina = PAGINAS_CONTEUDO.find(p => p.id === paginaId)!;
  const dados = rascunho?.paginas[paginaId];
  const organizar = pagina.organizar !== false;

  const mudar = (fn: (p: { valores: Record<string, string>; ordem: string[]; ocultas: string[] }) => void) => {
    setRascunho(r => { if (!r) return r; const n = clone(r); fn(n.paginas[paginaId]); return n; });
    setOk(""); setAviso("");
  };
  const setValor = (chave: string, v: string) => mudar(p => { p.valores[chave] = v; });

  const mover = (id: string, dir: -1 | 1) => {
    if (!dados) return;
    const g = grupo(pagina, id);
    if (!g) return setAviso("Este bloco tem posição fixa.");
    const i = dados.ordem.indexOf(id);
    let j = i + dir;
    while (j >= 0 && j < dados.ordem.length && grupo(pagina, dados.ordem[j]) !== g) j += dir;
    if (j < 0 || j >= dados.ordem.length) return setAviso("Já está no limite do seu grupo.");
    const ordem = [...dados.ordem]; [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    const m = validar(pagina, ordem, dados.ocultas);
    if (m) return setAviso(m);
    mudar(p => { p.ordem = ordem; });
  };
  const alternar = (id: string) => {
    if (!dados) return;
    const ocultas = dados.ocultas.includes(id) ? dados.ocultas.filter(x => x !== id) : [...dados.ocultas, id];
    const m = validar(pagina, dados.ordem, ocultas);
    if (m) return setAviso(m);
    mudar(p => { p.ocultas = ocultas; });
  };
  const restaurarPagina = () => {
    if (!window.confirm(`Restaurar toda a página "${pagina.titulo}" aos textos, imagens e ordem padrão? Continua como rascunho até salvar.`)) return;
    mudar(p => {
      p.valores = Object.fromEntries(pagina.secoes.flatMap(s => s.campos.map(c => [`${s.id}.${c.chave}`, c.padrao])));
      p.ordem = pagina.secoes.map(s => s.id); p.ocultas = [];
    });
  };
  const restaurarCampo = (chave: string, padrao: string) => {
    if (window.confirm("Restaurar este campo ao padrão?")) setValor(chave, padrao);
  };

  const salvar = async () => {
    if (!rascunho) return;
    setSalvando(true); setErro(null); setOk(""); setConflito(false);
    try {
      const salvo = await api.put<ConteudoSite>("/api/admin/conteudo", rascunho);
      setServidor(salvo); setRascunho(clone(salvo)); setOk("Conteúdo salvo e publicado.");
      try { await recarregar(); } catch { setAviso("Salvo, mas não foi possível atualizar a pré-visualização do site agora."); }
    } catch (x: any) {
      if (x?.status === 409) setConflito(true); else setErro(x);
    } finally { setSalvando(false); }
  };
  const descartar = () => {
    if (!servidor || !window.confirm("Descartar todas as alterações não salvas?")) return;
    setRascunho(clone(servidor)); setOk(""); setAviso(""); setErro(null); gravarRascunho(null);
  };
  const restaurarSalvo = () => { if (pendente) { setRascunho(clone(pendente)); setPendente(null); } };
  const descartarSalvo = () => {
    if (!window.confirm("Descartar o rascunho não salvo guardado neste navegador?")) return;
    gravarRascunho(null); setPendente(null);
  };

  if (erroCarga) return <><h1>Conteúdo do site</h1><Erro erro={erroCarga} /><button className="btn" onClick={() => void carregar()}>Tentar novamente</button></>;
  if (!rascunho || !dados) return <><h1>Conteúdo do site</h1><div className="cd-esq" aria-busy="true" aria-label="Carregando"><div /><div /><div /></div></>;

  return (
    <>
      <h1>Conteúdo do site</h1>
      <p className="suave">Edite textos, imagens, links e a ordem dos blocos. Tudo é texto simples. As mudanças ficam como rascunho até você salvar.</p>
      <fieldset className="cd-wrap" disabled={salvando} style={{border:0,padding:0,margin:0,minWidth:0}}>
        <nav className="cd-paginas" aria-label="Páginas editáveis">
          {PAGINAS_CONTEUDO.map(p => {
            const alterada = JSON.stringify(servidor!.paginas[p.id]) !== JSON.stringify(rascunho.paginas[p.id]);
            return <button key={p.id} type="button" aria-current={p.id === paginaId} onClick={() => { setPaginaId(p.id); setAviso(""); }}>
              <span>{p.titulo}</span>{alterada && <span className="cd-ponto" title="Alterada" aria-label="Alterada" />}
            </button>;
          })}
        </nav>
        <div>
          <div className="cd-barra">
            <button className="btn" onClick={salvar} disabled={!sujo || salvando} aria-busy={salvando}>{salvando ? "Salvando..." : "Salvar alterações"}</button>
            <button className="btn sec" onClick={descartar} disabled={!sujo || salvando}>Descartar</button>
            <button className="btn sec" onClick={restaurarPagina} disabled={salvando}>Restaurar página ao padrão</button>
            <span className="suave pequeno" role="status">{sujo ? "Alterações não salvas" : `Revisão ${servidor!.revisao}`}</span>
          </div>
          {pendente && (
            <div className="msg aviso" role="alert">
              Há um rascunho não salvo guardado neste navegador{pendente.revisao !== servidor!.revisao ? ", feito sobre uma revisão mais antiga: ao salvar, o servidor poderá pedir que você recarregue a versão atual" : ""}. Deseja restaurá-lo?
              <div className="linha" style={{ marginTop: 8 }}>
                <button className="btn mini" onClick={restaurarSalvo}>Restaurar rascunho</button>
                <button className="btn mini sec" onClick={descartarSalvo}>Descartar rascunho</button>
              </div>
            </div>
          )}
          <Erro erro={erro} />
          {ok && <Ok>{ok}</Ok>}
          {aviso && <div className="msg aviso" role="alert">{aviso}</div>}
          {conflito && (
            <div className="msg erro" role="alert">
              Outra pessoa salvou o conteúdo antes de você. Seu rascunho continua aqui e nada foi perdido. Copie o que for importante e use "Recarregar versão do servidor" para continuar a partir da versão mais recente (o rascunho atual será substituído).
              <div className="linha" style={{ marginTop: 8 }}>
                <button className="btn mini" onClick={() => { if (window.confirm("Substituir o rascunho pela versão do servidor?")) void carregar(); }}>Recarregar versão do servidor</button>
                <button className="btn mini sec" onClick={() => setConflito(false)}>Manter rascunho</button>
              </div>
            </div>
          )}
          <h2>{pagina.titulo}</h2>
          {pagina.nota && <Aviso>{pagina.nota}</Aviso>}
          {LINKS[pagina.id] && <p className="pequeno">Gerenciado em outras telas: {LINKS[pagina.id].map((l, i) => <span key={l.to + l.texto}>{i > 0 && " | "}<Link to={l.to}>{l.texto}</Link></span>)}</p>}
          {!organizar && <p className="suave pequeno">A ordem desta página é fixa.</p>}
          {dados.ordem.map(id => {
            const sec = pagina.secoes.find(s => s.id === id);
            if (!sec) return null;
            const oculta = dados.ocultas.includes(id);
            const g = grupo(pagina, id);
            const movivel = organizar && !!g;
            return (
              <section key={id} className={`cd-sec${oculta ? " oculta" : ""}`} aria-labelledby={`sec-${id}`}>
                <header>
                  <h3 id={`sec-${id}`}>{sec.titulo}{oculta && <span className="suave pequeno"> (oculta)</span>}</h3>
                  {movivel && <>
                    <button type="button" className="btn mini sec" onClick={() => mover(id, -1)} aria-label={`Mover ${sec.titulo} para cima`}>Subir</button>
                    <button type="button" className="btn mini sec" onClick={() => mover(id, 1)} aria-label={`Mover ${sec.titulo} para baixo`}>Descer</button>
                  </>}
                  {organizar && <button type="button" className="btn mini sec" onClick={() => alternar(id)} aria-pressed={oculta}>{oculta ? "Mostrar" : "Ocultar"}</button>}
                </header>
                {sec.campos.length === 0 ? <p className="suave pequeno" style={{ padding: "10px 16px", margin: 0 }}>Bloco sem textos editáveis aqui; apenas posição e visibilidade.</p> : (
                  <div className="cd-corpo">
                    {sec.campos.map(c => {
                      const chave = `${sec.id}.${c.chave}`;
                      const v = dados.valores[chave] ?? c.padrao;
                      const fid = `f-${paginaId}-${chave}`;
                      return (
                        <div key={chave} className={`cd-campo${c.tipo === "paragrafo" || c.tipo === "imagem" ? " largo" : ""}`}>
                          <label htmlFor={fid}>{c.rotulo}</label>
                          {c.tipo === "paragrafo" ? <textarea id={fid} rows={4} maxLength={c.limite} value={v} onChange={e => setValor(chave, e.target.value)} />
                            : c.tipo === "imagem" ? <div id={fid}><CampoImagem campo={c} valor={v} onChange={x => setValor(chave, x)} abrir={() => setCampoImg({ pagina: paginaId, chave, campo: c })} /></div>
                            : <input id={fid} type="text" maxLength={c.limite} value={v} onChange={e => setValor(chave, e.target.value)} placeholder={c.tipo === "link" ? "/pagina ou https://..." : undefined} />}
                          <div className="cd-meta">
                            <span className="suave pequeno">{c.tipo === "imagem" ? "Imagem" : c.tipo === "link" ? "Link" : `${v.length}/${c.limite}`}</span>
                            {c.tipo !== "imagem" && <button type="button" className="btn mini sec" disabled={v === c.padrao} onClick={() => restaurarCampo(chave, c.padrao)}>Restaurar padrão</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </fieldset>
      {campoImg && <Biblioteca campo={campoImg.campo} atual={rascunho.paginas[campoImg.pagina].valores[campoImg.chave]}
        onEscolher={url => { setRascunho(r => { if (!r) return r; const n = clone(r); n.paginas[campoImg.pagina].valores[campoImg.chave] = url; return n; }); setOk(""); setCampoImg(null); }}
        onFechar={() => setCampoImg(null)} />}
    </>
  );
}

function Biblioteca({ campo, atual, onEscolher, onFechar }: { campo: CampoConteudo; atual: string; onEscolher: (u: string) => void; onFechar: () => void }) {
  const [lista, setLista] = useState<Midia[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const [apagando, setApagando] = useState("");
  const [info, setInfo] = useState("");
  const carregar = useCallback(async () => {
    setErro(null);
    try { setLista((await api.get<{ midias: Midia[] }>("/api/admin/conteudo/midias")).midias); } catch (x) { setErro(x); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onFechar]);

  const enviar = async (f: File | undefined) => {
    if (!f) return;
    setErro(null); setInfo("");
    if (!/^image\/(jpeg|png)$/.test(f.type)) return setErro({ message: "Use uma imagem JPEG ou PNG." });
    if (f.size > 12 * 1024 * 1024) return setErro({ message: "A imagem excede 12 MB." });
    setEnviando(true);
    try { const m = await api.upload<Midia>("/api/admin/conteudo/midias", f); onEscolher(m.url); } catch (x) { setErro(x); } finally { setEnviando(false); }
  };
  const apagar = async (m: Midia) => {
    if (!window.confirm("Excluir esta imagem da biblioteca? Só é possível se nenhum campo a usar.")) return;
    setApagando(m.arquivo); setErro(null); setInfo("");
    try { await api.del(`/api/admin/conteudo/midias/${encodeURIComponent(m.arquivo)}`); setInfo("Imagem excluída."); await carregar(); }
    catch (x: any) { setErro(x?.status === 409 ? { message: "Imagem em uso por algum campo publicado; troque a imagem antes de excluir." } : x); }
    finally { setApagando(""); }
  };
  const padrao = campo.padrao.startsWith("/images/gramogol/") ? campo.padrao : null;

  return (
    <div className="cd-modal" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="bib-t">
        <div className="linha"><h2 id="bib-t" style={{ margin: 0 }} className="espaco">Imagem: {campo.rotulo}</h2><button className="btn mini sec" onClick={onFechar} autoFocus>Fechar</button></div>
        <p className="suave pequeno">Imagens enviadas ficam visíveis só para administradores até um campo salvo usá-las. Depois de escolher, clique em Salvar alterações.</p>
        <label className="btn" style={{ cursor: "pointer" }}>
          {enviando ? "Enviando..." : "Enviar nova imagem (JPEG ou PNG, até 12 MB)"}
          <input type="file" accept="image/jpeg,image/png" hidden disabled={enviando} onChange={e => { void enviar(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div style={{ marginTop: 10 }}><Erro erro={erro} />{info && <Ok>{info}</Ok>}</div>
        {padrao && <div className="cd-lib"><figure><img src={padrao} alt="Imagem padrão do campo" /><figcaption>Padrão do site</figcaption><button className="btn mini" onClick={() => onEscolher(padrao)}>{atual === padrao ? "Em uso" : "Usar"}</button></figure></div>}
        <h3>Biblioteca enviada</h3>
        {!lista && !erro && <div className="cd-esq" aria-busy="true"><div /></div>}
        {!!erro && !lista && <button className="btn mini" onClick={() => void carregar()}>Tentar novamente</button>}
        {lista && lista.length === 0 && <p className="suave">Nenhuma imagem enviada ainda.</p>}
        <div className="cd-lib">
          {lista?.map(m => (
            <figure key={m.arquivo}>
              <img src={m.url} alt={`Imagem enviada ${m.arquivo}`} loading="lazy" />
              <figcaption>{m.arquivo}<br />{m.publicado ? "Em uso publicado" : "Somente administradores"}</figcaption>
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
