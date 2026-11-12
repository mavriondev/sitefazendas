# Cadastro independente

O cadastro dos imóveis é manual e usa somente o banco e a pasta de uploads do próprio site.

- Removidos pesquisa de terras, consulta por CAR, atualização de bases do governo e geração externa de descrição.
- As rotas antigas respondem 404, mesmo se uma configuração antiga de pesquisa estiver ligada no banco.
- O painel não permite reativar a integração. CAR, coordenadas e polígono são opcionais e privados; não disparam consultas.
- Área, altitude, argila, água e energia são preenchidas no painel. Somente atributos autorizados em “Mostrar no site” participam da busca pública; continuam em faixas.
- Dados, fotos, fontes e datas já cadastrados são preservados. Uma edição manual registra sua própria procedência; não se convertem dados antigos em confirmação humana.
- Não há migração destrutiva: tabelas históricas de pesquisas e apresentações permanecem para preservar contatos e permitir reversão.
- Notícias e PTAX do dólar continuam com seus fornecedores atuais. SEO, PDF, WhatsApp, vídeos e mapas opcionais continuam disponíveis.

## Publicação futura

Esta alteração não modifica a configuração da VPS nem os serviços externos.
Na publicação autorizada, seguir o roteiro com backup do banco, uploads e configuração privada, um release isolado e reinício apenas de `gramogol.service`.
`HUB_API_URL`, `HUB_API_KEY`, `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL` não são mais necessários.
Remover somente essas entradas da configuração privada do **site**, nunca das configurações de outros serviços, após guardar backup privado.
Não revogar nem rotacionar chaves compartilhadas.

Conteúdos editoriais salvos no banco prevalecem sobre os padrões de código. Antes da publicação, revisar no painel os textos de privacidade e Sobre; alterar apenas referências antigas à pesquisa ou às consultas automáticas, preservando as demais edições.
