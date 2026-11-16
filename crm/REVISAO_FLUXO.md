# Revisão do fluxo do CRM

## Limites

- Revisão e verificações em ambiente sintético isolado.
- Nenhuma alteração na VPS, na main ou nos serviços de outros produtos.
- Origem do site continua somente leitura; arquivos públicos não são alterados.
- Sem migração destrutiva, reescrita em massa de telefones ou remoção de cadastros.

## Correções

1. **Telefone e duplicidade:** números brasileiros com DDD passam a ter a mesma
   identidade com ou sem `55`. A consulta também reconhece os registros antigos,
   sem exigir reescrita. A busca aceita telefone com espaços, parênteses e hífen.
2. **Contato importado incompleto:** é possível editar um registro já importado
   sem telefone; o campo continua obrigatório em novos contatos manuais e não
   pode ser apagado de um contato que já possui um número.
3. **Aviso de duplicidade:** trocar o número limpa a confirmação e o conflito
   anterior. Respostas atrasadas da consulta não sobrescrevem o aviso do número
   atual.
4. **Responsável bloqueado:** o contato pode continuar sendo atendido por quem
   tem permissão, sem obrigar uma transferência de responsável. Um usuário
   bloqueado não pode ser escolhido como novo responsável.
5. **Exclusão e acesso:** um membro não pode apagar um contato quando isso
   removeria vínculos ou negociações de fazendas fora do seu acesso. A exclusão
   exige revisão pelo administrador; a confirmação informa que as negociações
   também serão removidas. Nada é apagado no site de origem.
6. **Negociação encerrada:** concluir ou marcar como não avançou limpa o próximo
   retorno no servidor e no formulário; o campo fica desabilitado nessa etapa.
7. **Fazenda retirada:** novas negociações não podem ser abertas para fazendas
   retiradas da origem. O histórico permanece acessível e editável para encerrar
   negociações anteriores.
8. **Proteção de rascunhos:** navegação interna e Voltar/Avançar do navegador
   passam pelo mesmo bloqueio. Um salvamento bem-sucedido libera somente o
   rascunho que acabou de ser salvo, sem gerar confirmação falsa.
9. **Formulários em envio:** edição de contato, negociação, criação/redefinição
   de conta e envio de documento bloqueiam seus campos enquanto salvam.
   Escape e fechar não descartam um envio em andamento.
10. **Outros descartes:** nova conta e nova senha pedem confirmação ao fechar;
    categoria de documento também conta como alteração não salva. Uma falha ao
    sair da conta não desarma a proteção de rascunhos.
11. **Conflito de versão:** há ação explícita para recarregar a versão atual,
    com confirmação antes de descartar a edição local.
12. **Carregamento:** respostas pendentes de páginas já desmontadas ou de
    consultas anteriores não substituem o estado da consulta atual.

## Verificações automatizadas

- `npm run crm:check`: passou.
- `npm run crm:test`: nove grupos passaram, incluindo a nova regressão
  `crm/tests/flow-review.ts`.
- `NODE_ENV=production npm run crm:build`: passou.
- Regressões novas cobrem normalização e busca de telefone, dados antigos,
  importação sem telefone, bloqueio de responsável, exclusão com vínculos
  privados, retorno encerrado e fazenda retirada.
- A impressão digital da origem sintética permanece igual após operações do
  CRM; as alterações intencionais da fixture são delimitadas no teste.
