# Botões e apresentação

- CTAs da apresentação: 56 px no computador, 52 px no celular, larguras
  equilibradas no grupo; no celular ficam empilhados.
- Cabeçalho: CTA e ícone de acesso com 44 px.
- Ações da fazenda: botões de cabeçalho em duas colunas equivalentes; ações
  laterais com a mesma largura e 52 px.
- Painel: ações normais com pelo menos 44 px; compactas com 36 px.
  Salvar/descartar têm largura-base equivalente e passam a ocupar o espaço
  disponível em telas pequenas; abaixo de480px, ficam empilhados sem quebrar
  os rótulos em duas linhas. Cores e comportamentos permanecem iguais.
- Foco de teclado visível e ícones sem encolher.

## Remover as marcações existentes

Não há filtro permanente escondendo texto do painel. A limpeza é editorial e
pontual, mantém o painel como fonte dos textos e não acontece no início do app.
Não rodar seed. Slugs, IDs, telefones, WhatsApp, e-mails, URLs, arquivos, números, CAR e notas
internas não são alterados.
O endereço fictício que ainda diz para substituí-lo no painel fica vazio, sem
inventar um endereço de atendimento.

Após autorização para publicar e limpar o conteúdo:

1. Fazer backup do banco, uploads e configuração privada.
2. No release do site, executar:
   `npx tsx server/scripts/preparar-apresentacao.ts`
   Sem argumentos é somente leitura; retorna contagens e o hash do plano,
   sem valores de configuração ou credenciais.
3. Conferir o plano e aplicar a mesma versão:
   `npx tsx server/scripts/preparar-apresentacao.ts --apply --expected-plan=HASH`
4. Se o hash mudar, gerar e conferir outro plano; nunca ignorar a diferença.
5. Aplicação em transação. Edição concorrente ou falha aborta tudo. Rodar
   novamente deve produzir zero alterações.
6. Conferir Home, catálogo, detalhes, Sobre, parceiros, fotos e PDF; confirmar
   que contatos, intermediação, política de privacidade e rastreamento permanecem.

O CLI usa DATABASE_URL ou lê exclusivamente a configuração privada do site em
/etc/gramogol/runtime.json. Não escreve nessa configuração e não consulta nem
altera Hub, Connect ou outros serviços.

Os registros continuam identificáveis internamente e pelos slugs existentes.
Não se alteram URLs publicadas para retirar palavras dos endereços.
