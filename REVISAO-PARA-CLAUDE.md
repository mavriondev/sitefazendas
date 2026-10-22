# Estado da revisão do portal de fazendas

Esta entrega contém o código desenvolvido na prévia, para revisão. Não houve publicação em hospedagem de produção. O destino final será externo ao Replit e ainda não foi escolhido.

## O que mudou

- Layout inspirado no tema Agrezen indicado pelo usuário: verde profundo, detalhes em lima, fundos claros e fotos rurais.
- Página inicial com busca por região, cultura e área; navegação responsiva; listagem, cards e rodapé redesenhados.
- Busca integrada aos filtros reais da API, com estado vazio quando não há imóveis publicados. Nenhum anúncio fictício foi incluído.
- Uploads da prévia adaptados para armazenamento privado de objetos, preservando a remoção de metadados das fotos e restringindo acesso a imagens de rascunhos.
- Ajuste no deslocamento do mapa regional para evitar que os dois componentes arredondados coincidam com a localização original, com testes determinísticos.
- Arquitetura Express + React/Vite, painel e contratos existentes preservados.

## Validação já realizada no ambiente de desenvolvimento

- `npm run check`, `npm run build` e `npm test` passaram.
- Prévia visual conferida em computador e celular.
- Rotas públicas, filtros, imagens e saúde da API responderam com sucesso.
- Foram exercitados login administrativo, cadastro/edição/exclusão de registros temporários, upload e restrição de fotos, conta e redefinição de senha de uso único. Os registros temporários foram removidos.
- Não foi validado enriquecimento com uma fazenda real pela Hub.

## Atenção: não está pronto para produção externa

O README original descreve uploads locais, mas a implementação atual da prévia mudou:

- `server/index.ts` exige `PRIVATE_OBJECT_DIR` quando `NODE_ENV=production`.
- `server/lib/arquivos.ts`, `objectStorage.ts` e `objectAcl.ts` incluem integração com App Storage do Replit; o cliente usa autenticação do ambiente Replit.
- O valor atual de `UPLOADS_DIR` funciona como prefixo de objetos nesse modo. O caminho local é usado nos testes e quando o armazenamento de objetos está desativado.
- Portanto, apenas executar `npm start` em outro servidor não é suficiente. É necessário adaptar o armazenamento ao provedor externo aprovado, com persistência e as mesmas regras de acesso.
- O banco PostgreSQL deve continuar próprio deste site, separado do Mavrion Connect. Não substituir ou compartilhar o banco da Hub.
- Definir credenciais e variáveis no servidor de destino, incluindo banco, sessão, administrador, URL pública e armazenamento. Nenhum valor de credencial acompanha esta entrega.

## Pendências funcionais e de lançamento

1. Escolher a hospedagem externa e adaptar o armazenamento/configuração.
2. Obter uma chave dedicada para a Hub pelo fluxo seguro. A validação real ainda depende da chave, da autorização para configurá-la e de uma fazenda com CAR autorizada para teste.
3. Validar os valores reais de altitude e argila, a prévia pública e a publicação da primeira fazenda.
4. Preencher marca, CRECI e WhatsApp; revisar a política de privacidade antes de divulgar.
5. Manter a pesquisa de terras desligada até validar a integração.

## Regras de sigilo que devem permanecer

- CAR, município, coordenadas exatas e polígono não podem ser expostos nas respostas públicas.
- Publicar somente os campos liberados pelo corretor.
- Dados automáticos nunca viram “confirmados” sem validação humana.
- Falha de uma fonte significa “sem dado”, não ausência comprovada.
- Preservar remoção de EXIF/GPS e proteção das imagens de imóveis não publicados.

## Arquivos e imagens

O código do produto está na raiz desta branch, mantendo a organização do repositório original. Não foram incluídos outros aplicativos do workspace, banco, uploads de usuários, arquivos `.env`, dependências instaladas ou builds.

As fotos em `client/public/images/` são editoriais: não representam imóveis anunciados.

- `farmland-aerial.jpg`: Pexels, foto 31215327 — https://www.pexels.com/photo/31215327/
- `green-hills.jpg`: Pexels, foto 28578392 — https://www.pexels.com/photo/28578392/

Referência visual: https://preview.themeforest.net/item/agrezen-agriculture-organic-farm-wordpress-theme/full_screen_preview/60779615
