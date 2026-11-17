// Execute com esbuild --bundle --platform=node --format=esm --packages=external
// --loader:.css=empty, pois estes componentes importam os estilos do navegador.
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CardsFazenda } from "../../client/src/components/CardsFazenda";
import { Caracteristicas } from "../../client/src/components/Caracteristicas";
import { ItemFicha } from "../../client/src/pages/FazendaFicha";
import { CartaoFazenda } from "../../client/src/components/CartaoFazenda";
import { MemoryRouter } from "react-router-dom";
import type { AtributoPublico, FazendaPublica } from "../../client/src/api";
import type { CardPublico } from "../../shared/cards";

const proibidos = /(?:Texto|Informad[oa]s?|Confirmad[oa]s?|Informaç(?:ão|ões)|Seleção) (?:do|pelo) corretor/i;
const editorial: CardPublico = {
  id: "editorial", titulo: "Estrutura", informacao: "Galpão e curral",
  complemento: "Acesso interno", icone: "estrutura",
};
const renderCard = (atributo?: CardPublico["atributo"]) =>
  renderToStaticMarkup(<CardsFazenda cards={[{ ...editorial, atributo }]} />);
const atributos: AtributoPublico[] = [];

assert.equal(renderToStaticMarkup(<CardsFazenda cards={[]} />), "");
const textoLivre = renderCard();
assert.doesNotMatch(textoLivre, proibidos);
assert.doesNotMatch(textoLivre, /gcf-origem|lucide-pen-line|lucide-badge-check/);
assert.match(textoLivre, /Galpão e curral/);
assert.match(textoLivre, /Acesso interno/);

for (const origem of ["corretor", "oficial"] as const) {
  for (const confianca of ["indicado", "confirmado"] as const) {
    const atributo: AtributoPublico = {
      chave: "agua", rotulo: "Água", texto: "Disponibilidade cadastrada",
      origem, confianca, fonte: "Fonte sintética", atualizado_em: "2026-11-17",
    };
    atributos.push(atributo);
    const card = renderCard(atributo);
    const caracteristica = renderToStaticMarkup(<Caracteristicas atributos={[atributo]} />);
    const ficha = renderToStaticMarkup(<ItemFicha a={atributo} />);
    for (const html of [card, caracteristica, ficha]) {
      assert.doesNotMatch(html, proibidos);
      assert.doesNotMatch(html, /lucide-badge-check|Confirmado”/);
      if (origem === "oficial") {
        assert.match(html, /Fonte sintética/);
        assert.match(html, /17\/11\/2026/);
      } else {
        assert.doesNotMatch(html, /gcf-origem|ga-status|<small|lucide-shield-check/);
        // A presença de uma fonte no cadastro manual não o transforma em dado oficial.
        assert.doesNotMatch(html, /Fonte sintética/);
      }
    }
    assert.match(caracteristica, /Disponibilidade cadastrada/);
    assert.match(caracteristica, /verificação documental e em campo|não substituem documentos nem medição em campo/);
    assert.match(ficha, /Disponibilidade cadastrada/);
  }
}
// O render não muda dados, confiança, origem, fontes ou datas recebidos.
const antes = JSON.stringify(atributos);
renderToStaticMarkup(<Caracteristicas atributos={atributos.map((a, i) => ({ ...a, chave: `item-${i}` }))} />);
assert.equal(JSON.stringify(atributos), antes);
const semData: AtributoPublico = { chave: "agua", rotulo: "Água", texto: "Texto", origem: "oficial", confianca: "indicado" };
for (const html of [renderCard(semData), renderToStaticMarkup(<ItemFicha a={semData} />)]) {
  assert.doesNotMatch(html, /undefined|Invalid Date|atualizado em/);
}
assert.equal(renderToStaticMarkup(<Caracteristicas atributos={[]} />), "");
const fazenda: FazendaPublica = {
  slug: "fazenda-sintetica", titulo: "Fazenda sintética", descricao: "", regiao: "Região ampla",
  culturas: [], area: "Faixa pública", preco: null, destaque: true, capa: null, fotos: [],
  atributos: [], forma: null, videos: [], regiao_mapa: null, whatsapp: null, cards: [],
};
const anuncio = renderToStaticMarkup(<MemoryRouter><CartaoFazenda f={fazenda} /></MemoryRouter>);
assert.doesNotMatch(anuncio, proibidos);
assert.doesNotMatch(anuncio, /ga-farm-tag/);
assert.match(anuncio, /Fazenda sintética/);
console.log("ok   rótulos públicos, fontes, datas, cards editoriais, anúncio e ficha/PDF");
