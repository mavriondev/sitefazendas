# Gramogol Fazendas — proposta baseada no Agrezen

Esta pasta contém um **protótipo visual isolado**, para aprovação antes de alterar o site existente. Não modifica o banco, não altera os anúncios e não é uma implementação final.

## Visualizar fora do workspace

```sh
cd design/gramogol-agrezen
npm install
npm run dev
```

No endereço local informado pelo Vite, abra:

- `/__mockup/preview/gramogol-agrezen/Inicio`
- `/__mockup/preview/gramogol-agrezen/Fazenda`

As duas páginas compartilham componentes e estilos em `src/_shared/`. Os caminhos `/__mockup/` são exclusivos desta prévia e não devem ser transferidos sem adaptação para o site final.

## Referência seguida

O usuário reafirmou o tema [Agrezen](https://preview.themeforest.net/item/agrezen-agriculture-organic-farm-wordpress-theme/full_screen_preview/60779615) e pediu aproximação máxima de seus elementos de design.

Foram examinadas as cinco homepages, Sobre, Portfólio e grades 2/3/4, detalhe de projeto, Serviços e modelos classic/modern, detalhe de serviço, equipe e contato. Os índices de blog e loja também foram inspecionados; **não fazem parte do escopo** da Gramogol.

Elementos adaptados: tipografia Instrument Sans + Nunito Sans, fotografias com sobreposição verde, títulos grandes sem serifa, fundos brancos e creme muito claro, acentos verde/amarelo-esverdeado, botões preenchidos com cantos de 15px e setas diagonais, elementos vegetais, selos com ícones, cartões fotográficos e rodapé fotográfico verde. A marca e o logo continuam sendo da Gramogol.

O código do tema, suas fotos, logos e pacotes privados não foram copiados para esta pasta. Os componentes foram escritos para esta proposta, usando Lucide para ícones.

## Requisitos contemplados na proposta

- Página inicial e página de fazenda.
- Busca demonstrativa por região, atividade e faixa de área.
- Galeria ampliável com legendas, setas de teclado e gestos no celular.
- **Nenhum formulário na página de fazenda.**
- Contato pensado para WhatsApp contextual com o corretor.
- Ícones específicos para água, altitude, argila, relevo, chuva, energia, benfeitorias, uso do solo e logística.
- Distinção visual entre informação confirmada e indicada por fonte pública.
- Galeria visual de vídeos, pronta para receber links reais do YouTube na implementação.
- Fazendas semelhantes ao final.
- Localização pública aproximada, sem CAR, limites ou identificação do proprietário.

## Limites intencionais da prévia

Catálogo e dados são fictícios; fotos são geradas por IA para demonstração. Não representam propriedades anunciadas. O logo foi fornecido pelo usuário.

WhatsApp e vídeos não têm destinos reais fornecidos nesta proposta. Os cliques apresentam avisos honestos em vez de enviar mensagens a número fictício ou reproduzir conteúdo atribuído indevidamente a uma fazenda. O CRECI não foi informado. Parceiros reais não foram inventados. A autenticação e as telas administrativas continuam no site atual; esta pasta não as implementa.

Após aprovação visual, integrar aos dados e configurações já existentes do site; acrescentar o gerenciamento dos vídeos sem apagar dados existentes. Não incorporar blog, loja, FAQ ou mapa.
