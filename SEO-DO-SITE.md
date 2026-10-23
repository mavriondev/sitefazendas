# SEO pelo painel

Abra **Painel → SEO e buscadores** (`/admin/seo`).

## Configurações gerais

- **Endereço principal HTTPS:** domínio oficial sem caminhos ou parâmetros.
  Será usado nos links canônicos, sitemap, imagens sociais e robots.txt.
  A configuração do painel tem prioridade sobre `SITE_URL`.
  Isso não registra o domínio nem configura DNS ou certificado.
- **Título, descrição e imagem padrão:** alternativas quando não há conteúdo
  específico da página. As fazendas usam seu título, descrição pública e capa
  como alternativas naturais. Campos específicos têm prioridade.
- **Google/Bing:** cole somente o código público de verificação, sem HTML.
  Depois de instalar no domínio oficial, conclua a verificação na conta do
  respectivo buscador. O painel não conecta nem envia dados a essas contas.
- **Bloquear indexação:** opção intencional para desenvolvimento/manutenção,
  com confirmação. Ativa `noindex` e bloqueia o rastreamento em robots.txt.
  Não é controle de acesso nem apaga resultados já existentes imediatamente.

## Cada página e fazenda

Selecione a página ou fazenda para personalizar título, descrição, imagem de
compartilhamento e exclusão dos buscadores. Campos vazios usam alternativas
automáticas. Os títulos SEO são independentes dos títulos visíveis editados
em Conteúdo do site. As prévias são aproximadas: o buscador pode reescrever
títulos/descrições e os limites em caracteres são orientação, não garantia de
posicionamento.

Rascunhos ficam locais até salvar. Revisões impedem sobrescrever alterações de
outra sessão. Você pode descartar ou recuperar o rascunho neste navegador.
Limpar os campos de uma página também só produz um rascunho.

Fazendas não publicadas não são exibidas aos buscadores, mesmo que tenham SEO
preparado. Ao arquivar, retirar de publicação ou excluir um imóvel, ele sai do
sitemap e sua página pública responde 404. Configurações de imóveis excluídos
ou de slugs antigos são removidas do documento no próximo salvamento.

## Imagens e segurança

A biblioteca de SEO é separada da biblioteca editorial. Aceita JPEG/PNG até
12 MB, remove metadados sensíveis e mantém novos arquivos privados até serem
referenciados em configurações salvas. Uma imagem usada somente no SEO de um
imóvel não publicado permanece restrita ao administrador. Não se pode excluir
um arquivo ainda referenciado: remova as referências, salve e depois exclua.
Arquivos antes públicos podem permanecer em caches e cópias de terceiros.

Os uploads continuam no disco persistente do portal, adequado à instalação
independente na Hostinger; precisam de backup junto com o banco.

## Saída técnica

O HTML inicial de cada rota pública contém título único, descrição,
canonical, robots, Open Graph, Twitter Cards, verificações e JSON-LD básico de
página. O navegador também atualiza esses dados ao navegar sem recarregar.
HTML e respostas de SEO não ficam em cache; assets estáticos mantêm seu cache.
Não foi feita migração para SSR do conteúdo inteiro da aplicação.

`/sitemap.xml` inclui somente páginas indexáveis e imóveis publicados.
`/robots.txt` mantém painel, contas, pesquisa privada e API fora do rastreamento.
Sem um domínio configurado no painel ou em `SITE_URL`, o sitemap retorna uma
orientação de configuração, em vez de inventar um endereço de produção.
Robots e noindex não substituem autenticação ou regras de privacidade.

Nenhum campo aceita scripts ou HTML executável. Verificações aceitam somente
códigos. Os metadados são escapados no servidor. Canonicals não dependem do
cabeçalho Host recebido de terceiros. Rotas inexistentes retornam 404/noindex,
sem títulos ou descrições de imóveis privados.

Depois de instalar a versão na Hostinger e confirmar DNS/HTTPS, configure o
domínio oficial, confira `/robots.txt` e `/sitemap.xml`, e envie o sitemap pelo
Google Search Console. Configurar SEO não garante indexação ou posições.
