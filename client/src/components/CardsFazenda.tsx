import { BadgeCheck, Droplets, FileCheck2, House, Info, Layers, MapPin, Mountain, PenLine, Route, Ruler, ShieldCheck, Sprout, Trees, Zap } from "lucide-react";
import type { CardPublico, IconeCard } from "../../../shared/cards";
import "./CardsFazenda.css";

export const ICONES_CARD: Record<IconeCard, typeof Info> = {
  info: Info, area: Ruler, regiao: MapPin, agua: Droplets, solo: Layers, relevo: Mountain,
  estrutura: House, acesso: Route, vocacao: Sprout, energia: Zap, arvores: Trees, documento: FileCheck2,
};
const dataBr = (iso?: string) => { const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : null; };

/** Procedência honesta: dado oficial com fonte e data, dado do corretor com confiança, ou texto editorial do corretor. */
function Procedencia({ a }: { a: CardPublico["atributo"] }) {
  if (!a) return <span className="gcf-origem editorial"><PenLine aria-hidden="true" /><span>Texto do corretor</span></span>;
  if (a.origem === "oficial") {
    const dt = dataBr(a.atualizado_em);
    return <span className="gcf-origem oficial"><ShieldCheck aria-hidden="true" /><span>{a.confianca === "confirmado" ? "Confirmado pelo corretor · " : ""}Base pública{a.fonte ? `: ${a.fonte}` : ""}{dt ? ` · atualizado em ${dt}` : ""}</span></span>;
  }
  return <span className={`gcf-origem ${a.confianca}`}>{a.confianca === "confirmado" ? <BadgeCheck aria-hidden="true" /> : <Info aria-hidden="true" />}<span>{a.confianca === "confirmado" ? "Confirmado pelo corretor" : "Informado pelo corretor"}</span></span>;
}

export function CardsFazenda({ cards, rotulo = "Informações principais do imóvel" }: { cards: CardPublico[] | undefined; rotulo?: string }) {
  if (!cards?.length) return null;
  return (
    <section className="gcf" aria-label={rotulo} data-quantidade={cards.length}>
      <ul className="gcf-grade">
        {cards.map((c, i) => {
          const Icone = ICONES_CARD[c.icone] ?? Info;
          return (
            <li className="gcf-card" key={c.id} style={{ ["--gcf-i" as string]: Math.min(i, 12) }} data-testid={`card-fazenda-${c.id}`}>
              <span className="gcf-icone"><Icone aria-hidden="true" /></span>
              <div className="gcf-corpo">
                <h3 className="gcf-titulo">{c.titulo}</h3>
                <p className="gcf-info">{c.informacao}</p>
                {c.complemento && <p className="gcf-compl">{c.complemento}</p>}
                <Procedencia a={c.atributo} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
