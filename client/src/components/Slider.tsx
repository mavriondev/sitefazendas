import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export interface SlideItem { id: number; titulo: string | null; subtitulo: string | null; imagem: string | null; link: string | null }

export function Slider({ slides }: { slides: SlideItem[] }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || pausa) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length, pausa]);
  if (slides.length === 0) return null;
  const mover = (d: number) => setI((x) => (x + d + slides.length) % slides.length);
  return (
    <section className="slider" aria-roledescription="carrossel" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      {slides.map((s, k) => (
        <div key={s.id} className={`slide${k === i ? " ativo" : ""}`} style={s.imagem ? { backgroundImage: `url(${s.imagem})` } : { background: "#1d4a2c" }} aria-hidden={k !== i}>
          <div className="texto"><div className="container">
            {s.titulo && <h2>{s.titulo}</h2>}
            {s.subtitulo && <p>{s.subtitulo}</p>}
            {k === i && s.link && (s.link.startsWith("/") ? <Link className="btn" to={s.link}>Ver fazenda</Link> : <a className="btn" href={s.link} rel="noopener noreferrer">Saiba mais</a>)}
          </div></div>
        </div>
      ))}
      {slides.length > 1 && (
        <>
          <div className="setas"><button type="button" onClick={() => mover(-1)} aria-label="Anterior">‹</button><button type="button" onClick={() => mover(1)} aria-label="Próximo">›</button></div>
          <div className="pontos">{slides.map((s, k) => <button type="button" key={s.id} className={k === i ? "ativo" : ""} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-current={k === i} />)}</div>
        </>
      )}
    </section>
  );
}
