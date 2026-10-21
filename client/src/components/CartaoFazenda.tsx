import { Link } from "react-router-dom";
import type { FazendaPublica } from "../api";

export function CartaoFazenda({ f }: { f: FazendaPublica }) {
  return (
    <Link to={`/fazenda/${f.slug}`} className="cartao fazenda-card">
      <div className="moldura">
        <div className="foto" style={f.capa ? { backgroundImage: `url(${f.capa})` } : undefined} role="img" aria-label={f.titulo} />
        {f.destaque && <span className="destaque">Destaque</span>}
      </div>
      <div className="corpo">
        <h3>{f.titulo}</h3>
        <div className="meta">{[f.regiao, f.area].filter(Boolean).join(" · ")}</div>
        <div style={{ marginTop: 8 }}>{f.culturas.slice(0, 4).map((c) => <span className="etiqueta" key={c}>{c}</span>)}</div>
        {f.preco && <strong>{f.preco}</strong>}
      </div>
    </Link>
  );
}
