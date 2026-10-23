import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api, soDigitos, type FazendaPublica } from "../api";
import { useSite } from "../contexto";
import { useConteudo } from "../components/Conteudo";
import { ICONES } from "../components/Caracteristicas";
import { Info } from "lucide-react";
import "../ficha.css";

const dataBr = (iso?: string) => { const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : null; };
/** 5531999990000 → (31) 99999-0000 */
export function telefoneBonito(numero?: string | null): string | null {
  let d = numero ? soDigitos(numero) : "";
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d.length >= 8 ? d : null;
}

/** Ficha da fazenda para impressão / "Salvar como PDF". Usa SÓ a projeção pública (mesmo que a página da fazenda). */
export default function FazendaFicha() {
  const { slug } = useParams();
  const [busca] = useSearchParams();
  const { config } = useSite();
  const { texto: t } = useConteudo("global");
  const [f, setF] = useState<FazendaPublica | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    void api.get<FazendaPublica>(`/api/public/fazendas/${encodeURIComponent(slug || "")}`).then((r) => { if (ativo) setF(r); }).catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [slug]);
  const nome = config?.nome_site || "Gramogol Fazendas";
  useEffect(() => {
    if (f) document.title = `${f.titulo} - ${nome}`;
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "robots"; document.head.appendChild(meta); }
    meta.content = "noindex";
  }, [f, nome]);
  // Abre a janela de impressão sozinha (vindo do botão), depois que as imagens carregaram.
  useEffect(() => {
    if (!f || busca.get("imprimir") !== "1") return;
    const imgs = Array.from(document.images);
    void Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((ok) => { i.onload = i.onerror = () => ok(null); }))))
      .then(() => setTimeout(() => window.print(), 300));
  }, [f, busca]);

  if (erro) return <div className="ficha-erro">Fazenda não encontrada. <Link to="/fazendas">Voltar às fazendas</Link></div>;
  if (!f) return <div className="ficha-erro" role="status">Preparando a ficha…</div>;

  const logo = t("marca.logo_rodape") || "/images/gramogol/logo-gramogol-claro.png";
  const fone = telefoneBonito(f.whatsapp || config?.whatsapp_padrao);
  const contatos = [fone && `WhatsApp ${fone}`, config?.contato_email, config?.instagram_url?.replace(/^https?:\/\/(www\.)?/, "")].filter(Boolean) as string[];
  const corretor = f.atributos.filter((a) => a.origem !== "oficial");
  const governo = f.atributos.filter((a) => a.origem === "oficial");
  const ultima = dataBr(governo.map((a) => a.atualizado_em || "").sort().pop());
  const fontes = [...new Set(governo.map((a) => a.fonte).filter(Boolean))].join(", ");
  const fotos = f.fotos.slice(0, 4);
  const hoje = new Date().toLocaleDateString("pt-BR");
  const Item = ({ a, gov }: { a: FazendaPublica["atributos"][number]; gov: boolean }) => {
    const Icon = ICONES[a.chave] || Info;
    return <li className="ficha-item"><Icon aria-hidden="true" width={18} height={18} /><div><span>{a.rotulo}</span><strong>{a.texto}</strong>
      <small>{gov ? `Fonte: ${a.fonte}${dataBr(a.atualizado_em) ? ` · atualizado em ${dataBr(a.atualizado_em)}` : ""}` : a.confianca === "confirmado" ? "Confirmado pelo corretor" : "Informado pelo corretor"}</small></div></li>;
  };

  return (
    <div className="ficha">
      <div className="ficha-barra" role="toolbar">
        <Link to={`/fazenda/${f.slug}`}>← Voltar à fazenda</Link>
        <button type="button" onClick={() => window.print()}>Salvar como PDF / Imprimir</button>
        <span>Na janela que abrir, escolha “Salvar como PDF” e deixe os gráficos de fundo ligados.</span>
      </div>

      <section className="ficha-pagina ficha-capa">
        {f.capa && <img className="ficha-capa-foto" src={f.capa} alt="" />}
        <div className="ficha-capa-faixa">
          <img className="ficha-logo" src={logo} alt={nome} />
          <p className="ficha-rotulo">Apresentação do imóvel</p>
          <h1>{f.titulo}</h1>
          <p className="ficha-sub">{[f.regiao, f.area].filter(Boolean).join(" · ")}</p>
          {f.preco && <p className="ficha-preco">{f.preco}</p>}
          <div className="ficha-contato">{contatos.map((c) => <span key={c}>{c}</span>)}{config?.texto_creci && <span>{config.texto_creci}</span>}</div>
        </div>
      </section>

      <section className="ficha-pagina ficha-conteudo">
        <header className="ficha-cab"><strong>{f.titulo}</strong><span>{nome}</span></header>
        <div className="ficha-fatos">
          {[["Área", f.area || "Consultar"], ["Região", f.regiao || "—"], ["Vocação", f.culturas.join(" · ") || "Uso rural"], ["Valor", f.preco || "Sob consulta"]].map(([r, v]) => <div key={r}><span>{r}</span><strong>{v}</strong></div>)}
        </div>
        {f.descricao && <><h2>Sobre a propriedade</h2>{f.descricao.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</>}
        {corretor.length > 0 && <><h2>Informações do imóvel</h2><ul className="ficha-lista">{corretor.map((a) => <Item key={a.chave} a={a} gov={false} />)}</ul></>}
        {governo.length > 0 && <><h2>Dados do governo sobre o ativo</h2><ul className="ficha-lista">{governo.map((a) => <Item key={a.chave} a={a} gov />)}</ul>
          <p className="ficha-nota">Dados de bases públicas do governo ({fontes}){ultima ? `; última atualização em ${ultima}` : ""}. São indicativos, não substituem documentos nem medição em campo e podem estar defasados.</p></>}
        {fotos.length > 0 && <><h2>Fotos</h2><div className="ficha-fotos">{fotos.map((x, i) => <figure key={i}><img src={x.url} alt={x.legenda || ""} />{x.legenda && <figcaption>{x.legenda}</figcaption>}</figure>)}</div></>}
        <footer className="ficha-rodape">
          <div className="ficha-fale"><strong>Fale com o corretor</strong>{contatos.map((c) => <span key={c}>{c}</span>)}{config?.contato_horario && <span>{config.contato_horario}</span>}{config?.texto_creci && <span>{config.texto_creci}</span>}</div>
          <p>{config?.aviso_intermediacao || "As informações são indicativas e não substituem a verificação documental. Localização detalhada e documentação são tratadas em atendimento direto."}</p>
          <p>Ficha gerada em {hoje} · {nome}</p>
        </footer>
      </section>
    </div>
  );
}
