# CRM interno Gramogol

Módulo independente para a equipe, servido em `/crm`. Não é extensão das permissões
editoriais de `/admin` e não escreve nas tabelas do site. Não tem integrações com Hub,
Connect ou serviços de enriquecimento.

## Desenvolvimento e verificação

Na raiz do repositório standalone:

```sh
npm ci
npm run crm:check
npm run crm:test
npm run crm:build
PORT=3100 npm run crm:preview
```

Prévia: `http://localhost:3100/crm`. Usuário exclusivamente sintético:
`gestor@crm.test`; senha de teste: `Senha-exclusiva-teste-2026`.
Essas credenciais não são usadas pelo ponto de entrada de produção. A prévia
ignora os bancos e segredos do ambiente, cria duas bases PGlite sintéticas e
arquivos temporários. Ao reiniciar, os dados da prévia são reinicializados.
Não cadastrar informações reais nela. Os testes automatizados removem suas
próprias pastas temporárias.

`npm run check`, `npm test` e `npm run build` continuam sendo as verificações do site.
O build do CRM gera `dist-crm`, sem substituir `dist` do site. Nenhuma dependência
nova é necessária e o lockfile original permanece válido.

## Separação e permissões

- Processo, banco PostgreSQL de escrita, sessão (`gramogol.crm.sid`, caminho `/crm`)
  e diretório de documentos próprios. As contas do CRM não autenticam em `/admin`.
- Sem cadastro público. Um administrador inicial é criado uma única vez pelo
  bootstrap; depois ele cria contas de membros. O administrador inicial não pode
  bloquear a si próprio. A primeira versão tem um administrador principal.
- Administrador acessa todos os registros. Membro vê/edita contatos dos quais é
  responsável ou que receberam liberação explícita; fazendas e seus documentos
  exigem liberação separada. Vincular contato a uma fazenda não concede acesso
  automaticamente. Redefinir senha e bloquear conta invalida sessões existentes.
- Permissões são verificadas em toda API, inclusive anexos e fotos. Respostas
  privadas têm `no-store` e `noindex`; documentos nunca são publicados, incluídos
  em PDF público nem servidos por diretório estático.
- Escritas nas entidades comerciais usam transações, versão de concorrência e
  chaves de requisição para evitar registros duplicados no reenvio. Duplicidade de
  telefone gera aviso, não fusão automática. Ao haver cadastro restrito, o aviso
  não identifica seu titular.
- Histórico guarda autor/data das mudanças, etapas, observações de negociação e
  ações de documentos. Excluir contato remove os seus negócios e vínculos no CRM,
  mantendo apenas auditoria mínima; não exclui contatos/apresentações no site.

## Origem dos dados

O adaptador só oferece `read()`. Usa transação PostgreSQL `READ ONLY`, pool reduzido,
timeout e uma conta cujo acesso de escrita nas cinco tabelas de origem deve ser
negado. O serviço **não cria** essa conta, não concede privilégios e não executa
migrações na origem. Nomes dos bancos de origem e CRM precisam ser diferentes.

O administrador aciona **Atualizar da origem** para atualizar a cópia das fazendas
e **Importar contatos** para trazer contatos/apresentações. Não há sincronização
automática nem escrita reversa. Cópias são identificadas por ID do site; contatos
por tipo/ID da origem, não por telefone. Reimportar não sobrescreve atendimento
feito no CRM. É recomendável atualizar fazendas antes de importar os contatos.
Se não há mais um anúncio, sua cópia permanece como indisponível, sem links
públicos. Se a leitura falha, dados anteriores são mantidos e o erro aparece.
Contatos importados sem telefone válido ficam sem telefone, com o texto original
da apresentação nas observações; o sistema nunca inventa um número.

As fotos permanecem no diretório do site, montado/permitido como **somente leitura**.
São entregues por uma rota privada do CRM após conferir fazenda e nome cadastrado.
Publicação de uma fazenda não equivale a liberação do acesso comercial.

## Documentos

PDF simples, JPEG e PNG, até 12 MB. Imagens são validadas e têm metadados removidos
pelo sanitizador já usado no produto. PDFs precisam de assinatura e término
válidos; recursos ativos, JavaScript, anexos, criptografia e object streams são
rejeitados. O download sempre é attachment, com CSP restrita; não há visualizador
embutido. Nomes físicos são aleatórios; o nome original é higienizado.

Isso **não é antivírus nem certificação do conteúdo**. Arquivos recebidos de fora
da equipe precisam de verificação de origem; inspeção antimalware/quarentena é uma
evolução separada. Documentos usam pasta exclusiva modo 0700 e arquivos 0600;
não apontar essa pasta para uploads públicos, raiz web, assets ou diretórios do site.

## Limites intencionais

Cliques em WhatsApp não identificam visitantes nem capturam conversas. Lembretes
aparecem no CRM, sem envio de mensagens ou notificações externas. Datas de retorno
são armazenadas com fuso (UTC) e exibidas no fuso do dispositivo.

Os dados só são atualizados da origem por ação administrativa. Um snapshot não é
consulta em tempo real e a data é exibida. Os documentos e dados comerciais não são
enviados a Analytics/Pixel. Para teste visual, usar apenas a prévia sintética.

Instalação futura: ver `deploy/INSTALACAO.md`. Não executar em produção sem autorização.
