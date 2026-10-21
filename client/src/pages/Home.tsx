import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type FazendaPublica } from "../api";
import { useSite } from "../contexto";
import { Slider, type SlideItem } from "../components/Slider";
import { CartaoFazenda } from "../components/CartaoFazenda";

export default function Home() {
  const { config } = useSite();
  const [dados, setDados] = useState<{ slides: SlideItem[]; destaques: FazendaPublica[] } | null>(null);
  useEffect(() => { void api.get("/api/public/home").then(setDados).catch(() => setDados({ slides: [], destaques: [] })); }, []);
  return (
    <>
      {dados && dados.slides.length > 0 ? <Slider slides={dados.slides} /> : (
        <section className="hero-simples"><div className="container">
          <h1>{config?.hero_titulo}</h1><p>{config?.hero_subtitulo}</p>
          <Link className="btn" style={{ background: "#fff", color: "var(--verde-esc)" }} to="/fazendas">Ver fazendas</Link>
        </div></section>
      )}
      <div className="container pagina">
        <div className="linha" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Fazendas em destaque</h2><span className="espaco" /><Link to="/fazendas">Ver todas →</Link></div>
        {dados && dados.destaques.length === 0 && <p className="suave">Em breve novas fazendas. <Link to="/fazendas">Veja todas as disponíveis</Link>.</p>}
        <div className="grade">{dados?.destaques.map((f) => <CartaoFazenda key={f.slug} f={f} />)}</div>
        {config?.modulo_pesquisa_ativo && (
          <div className="painel" style={{ marginTop: 28 }}>
            <h3>Procura uma terra específica?</h3>
            <p>Pesquise terras por estado, área, altitude e solo. Os detalhes completos são liberados em atendimento direto.</p>
            <Link className="btn sec" to="/pesquisa">Pesquisar terras</Link>
          </div>
        )}
      </div>
    </>
  );
}
