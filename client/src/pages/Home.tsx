import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, linkWhatsapp, type FazendaPublica } from "../api";
import { useSite } from "../contexto";
import { Slider, type SlideItem } from "../components/Slider";
import { CartaoFazenda } from "../components/CartaoFazenda";
import { BuscaRapida } from "../components/BuscaRapida";

const PASSOS = [
  ["01", "Navegue com discrição", "Veja as fazendas disponíveis sem expor sua identidade. O portal mostra apenas as informações liberadas para o público."],
  ["02", "Peça os detalhes", "Interessou-se por uma propriedade? Solicite o contato e os dados complementares são tratados em atendimento direto."],
  ["03", "Fale com o corretor", "Converse com o corretor responsável. Os detalhes completos e as visitas são tratados por intermediação."],
];

export default function Home() {
  const { config } = useSite();
  const [dados, setDados] = useState<{ slides: SlideItem[]; destaques: FazendaPublica[] } | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    void api.get("/api/public/home").then((resposta) => { if (ativo) setDados(resposta); }).catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, []);
  const zap = linkWhatsapp(config?.whatsapp_padrao, "Olá! Gostaria de conversar sobre fazendas à venda.");
  return (
    <>
      {dados && dados.slides.length > 0 ? <Slider slides={dados.slides} /> : (
        <section className="hero"><div className="container">
          <span className="sobre">Fazendas à venda</span>
          <h1>{config?.hero_titulo || "Fazendas selecionadas"}</h1><p className="sub">{config?.hero_subtitulo || "Propriedades rurais e atendimento direto com o corretor."}</p>
          <div className="linha"><Link className="btn lima" to="/fazendas">Ver fazendas</Link>
            {zap && <a className="btn fantasma" href={zap} target="_blank" rel="noopener noreferrer">Falar com o corretor</a>}</div>
        </div></section>
      )}
      <BuscaRapida />
      <div className="container">
        <section className="secao">
          <div className="cab"><div><span className="rotulo-sec">Seleção do corretor</span><h2>Fazendas em destaque</h2></div><span className="espaco" /><Link className="link-seta" to="/fazendas">Ver todas</Link></div>
          {erro ? (
            <div className="msg erro" role="alert">Não foi possível carregar os destaques. <Link to="/fazendas">Tente consultar o catálogo</Link>.</div>
          ) : !dados ? (
            <p className="suave" role="status">Carregando fazendas em destaque…</p>
          ) : dados.destaques.length === 0 ? (
            <div className="vazio"><div className="selo-vazio" aria-hidden="true" />
              <h3>Nenhuma fazenda em destaque no momento</h3>
              <p>Consulte o catálogo para ver as fazendas disponíveis. Os anúncios em destaque aparecerão aqui quando forem publicados.</p>
              <div className="linha" style={{ justifyContent: "center" }}><Link className="btn" to="/fazendas">Ver fazendas disponíveis</Link>{zap && <a className="btn sec" href={zap} target="_blank" rel="noopener noreferrer">Falar com o corretor</a>}</div>
            </div>
          ) : <div className="grade">{dados?.destaques.map((f) => <CartaoFazenda key={f.slug} f={f} />)}</div>}
        </section>
        <section className="secao">
          <div className="cab"><div><span className="rotulo-sec">Como funciona</span><h2>Compra séria começa com conversa direta</h2></div></div>
          <div className="passos">{PASSOS.map(([n, t, d]) => <div className="passo" key={n}><div className="n">{n}</div><h3>{t}</h3><p>{d}</p></div>)}</div>
        </section>
      </div>
      <section className="faixa"><div className="container">
        <div><span className="rotulo-sec" style={{ color: "var(--lima)" }}>Atendimento direto</span><h2>Quer vender ou comprar com reserva?</h2>
          <p>{config?.aviso_intermediacao || "Atuamos na intermediação de negócios rurais."}</p></div>
        <div className="linha">
          <Link className="btn lima" to="/fazendas">Explorar fazendas</Link>
          {config?.modulo_pesquisa_ativo && <Link className="btn fantasma" to="/pesquisa">Pesquisar terras</Link>}
          {!config?.modulo_pesquisa_ativo && <Link className="btn fantasma" to="/cadastro">Criar cadastro</Link>}
        </div>
      </div></section>
    </>
  );
}
