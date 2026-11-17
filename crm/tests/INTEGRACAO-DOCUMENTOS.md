# Teste integrado dos documentos: painel → CRM

```sh
npm run test:documents:integrated
```

Executar na raiz do repositório standalone `mavriondev/sitefazendas`, após
`npm ci`. O teste foi preparado a partir de
`release/gramogol-atualizacao-completa-20261116`.
Não requer nem utiliza configurações, documentos, bancos ou senhas de produção.

## Pré-requisitos

- Linux com `unshare`, `sh` e `mount`, permitindo namespaces de usuário e de
  montagem sem privilégios (`unshare -Urm true`).
- PostgreSQL local: `initdb` e `pg_ctl` no `PATH`.
- Node e dependências do projeto. Não executar como root: `initdb` exige usuário
  comum.

Se um requisito estiver ausente, o teste **falha**. Não substitui permissões por
mocks nem apresenta um teste parcial como aprovado. Não instala serviços,
não usa sudo, Docker ou configuração do PostgreSQL do computador.

## Ambiente descartável

O teste cria um cluster PostgreSQL próprio, escutando **somente em um socket
Unix privado**, e dois bancos novos. O painel usa o banco sintético do site.
O CRM usa outro banco, com usuário próprio sem privilégios administrativos e
sem permissão de conexão ao banco do site.

A origem do CRM usa `PgSource` real, senha SCRAM gerada para a execução e uma
conta `source_reader` com SELECT exclusivamente nas tabelas necessárias. Uma
senha incorreta é recusada para comprovar que a autenticação não está usando
trust para essa conta. O teste tenta escritas SQL fora da transação READ ONLY,
comprovando também os grants, não apenas a proteção do adaptador.

O site e o CRM atendem em portas HTTP locais efêmeras, com sessões e CSRF reais.
O CRM roda em processo separado e em namespace de montagem próprio: a pasta
privada do site é exposta por bind mount **somente leitura**. Não há cópia de
documentos para uma fixture do CRM. Mesmo um arquivo criado pelo painel depois
de o CRM iniciar é o mesmo arquivo lido pelo CRM.

Os processos auxiliares recebem ambiente reduzido, sem herdar URLs de bancos,
senhas administrativas ou configuração de serviços do workspace. Os diretórios
ficam sob `generated-artifacts/` (ignorado pelo Git), com socket temporário curto
para respeitar o limite de tamanho dos sockets Unix.

## O que precisa passar

1. Login no painel e no CRM pelas APIs usadas pelas telas; criação de fazenda
   sintética e atribuição de acesso a um membro da equipe.
2. Envio multipart de PDF sintético pela API do painel; criação com UMask `0077`
   e arquivo final `0640` em pasta privada pré-provisionada `2750`. A pasta de
   fotos públicas permanece vazia.
3. Listagem imediata no CRM para administrador e membro autorizado, sem
   atualização da origem; metadados iguais aos enviados, sem nome físico de
   arquivo; download byte a byte igual, como anexo e sem cache.
4. Recusa de listagem/download para anônimos e usuários sem acesso à fazenda;
   upload e exclusão anônimos também recusados no painel.
5. Recusa de envio, edição e exclusão pelas APIs do CRM; recusa de
   INSERT/UPDATE/DELETE/TRUNCATE/DDL no banco da origem e de leitura de usuários
   do site pela credencial de origem.
6. Cinco operações reais no processo do CRM (alterar arquivo, criar arquivo,
   criar pasta, renomear e remover) recusadas pelo kernel com `EROFS`.
   Metadados e hashes da origem permanecem iguais após a leitura e as recusas;
   o registro de download ocorre somente no banco do CRM.
7. Exclusão pelo painel: registro e arquivo somem; a lista do CRM fica vazia
   e o download antigo retorna 404, sem refresh/import intermediário.
8. Encerramento dos dois servidores e do cluster e remoção dos diretórios,
   inclusive quando uma asserção falha.

## Limites

Este é um teste de integração HTTP, PostgreSQL e sistema de arquivos, não um
teste de cliques no navegador. Não altera as prévias independentes existentes.
Não valida instalação em VPS, proxy, HTTPS, systemd, ACLs nem identidades Unix
de produção. Confere os modos `2750/0640` e a montagem RO efetiva, mas não tenta
reproduzir grupos de usuários da VPS. Nenhuma instalação ou publicação é feita.

O comando é separado de `npm test` e `npm run crm:test`, pois exige PostgreSQL
nativo e recursos específicos do kernel. Para validar o conjunto:

```sh
npm run check
npm run crm:check
npm test
npm run crm:test
npm run test:documents:integrated
```
