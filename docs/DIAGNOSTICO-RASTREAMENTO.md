# Diagnóstico de Analytics e Pixel

No painel, abra **SEO → Google Analytics e Pixel da Meta → Diagnóstico da
integração**. Os estados referem-se à configuração **salva**. Salve mudanças
antes de abrir o teste em uma nova aba.

## O que cada estado confirma

- **Desligado:** o provedor está desativado no site; não há tentativa de carregar.
- **ID inválido:** o formato está incorreto. Corrija o ID no painel; não cole
  scripts. Um ID com formato válido não prova que existe nem que pertence à conta.
- **Configuração válida, navegador não testado:** o formato e a ativação permitem
  testar; o painel nunca baixa bibliotecas de rastreamento.
- **Consentimento pendente / não concedido:** nenhuma tentativa de carregar esse
  provedor foi autorizada nesta página.
- **Carregando:** a tag foi inserida, mas o carregamento não foi confirmado.
  `gtag`, `dataLayer` e `fbq` podem existir somente como filas.
- **Script carregado:** o navegador disparou `load`. Isso **não** prova
  funcionamento completo, entrega do evento, propriedade correta ou recebimento
  pela conta.
- **Erro do navegador / tempo esgotado:** erro de carregamento ou ausência de
  confirmação por 12 segundos. Rede, CSP e extensões são causas possíveis; o
  diagnóstico não consegue identificar com certeza um bloqueador.

O evento existente `gramogol:tracking-error` sinaliza erros e expiração do prazo,
com apenas o identificador local da tag. Não há envio de relatórios de erro,
identificadores pessoais ou histórico de navegação ao servidor.

## Teste público com autorização

`/diagnostico-rastreamento` responde HTTP 200, usa `noindex, nofollow`, não tem
canonical e não entra no sitemap. Não faz parte da lista de páginas medidas
automaticamente. Não reutiliza nem modifica o consentimento salvo no navegador.

1. Leia a configuração atual e marque Analytics, Marketing ou ambos.
2. Clique **Autorizar e iniciar teste**. Marcar a caixa, sozinho, não inicia nada.
3. Observe os estados por provedor. Query e fragmento da URL são removidos antes
   de iniciar as tags. O teste solicita somente `page_view` (GA4) /
   `PageView` (Meta), sem conversões extras nem dados pessoais adicionados pelo
   site. Os provedores podem tratar dados técnicos e criar cookies após a
   autorização; veja a política de privacidade.
4. Para retirar a autorização ou reiniciar, use **Revogar e encerrar teste**:
   interrompe o runtime, remove os cookies conhecidos dos provedores iniciados e
   recarrega a página. Remover só a tag não descarrega JavaScript já executado.
   O consentimento anterior do site permanece inalterado.
5. Mudou a configuração no painel? Salve e recarregue a página de teste.

Falhas não provocam retentativa por outro domínio, proxy ou desativação de
proteções. A configuração não é alterada pelo teste.

## Recebimento: conferir nas ferramentas oficiais

### Google Analytics 4

1. Na propriedade correta do [Google Analytics](https://analytics.google.com/),
   abra **Administrador → Fluxos de dados → Web** e confira o ID `G-…` salvo.
2. Abra **Relatórios → Tempo real** e procure `page_view` após autorizar Analytics
   na página de teste. O caminho deve ser `/diagnostico-rastreamento`.
3. Pode haver atraso. Ausência no relatório não identifica, sozinha, a causa.
   Confira propriedade, fluxo, filtros e permissões.
4. **DebugView** só exibe eventos com depuração habilitada. Este teste não ativa
   `debug_mode` automaticamente; não trate um DebugView vazio como falha conclusiva.

### Meta

1. No [Gerenciador de Eventos](https://business.facebook.com/events_manager2/),
   selecione a fonte de dados com o mesmo ID do Pixel salvo no painel.
2. Abra **Testar eventos**, use o fluxo de teste de eventos do site oferecido pela
   ferramenta e informe a URL pública `/diagnostico-rastreamento`.
3. Na página aberta, autorize **Marketing** e inicie o teste. Procure `PageView`
   na ferramenta e confira a fonte de dados selecionada.
4. Pode haver atraso ou filtros. O carregamento da biblioteca e uma fila no
   navegador não são confirmação de recebimento na Meta.

## Validação isolada

`npm run check`, `npm test` e `npm run build` incluem verificação de tipos,
runtime sem rede e contrato HTTP/SEO/CSP. Para uma prévia descartável:

```sh
npm run build
NODE_ENV=test PORT=5078 npx tsx server/__tests__/preview-diagnostico.ts
```

A prévia cria PGlite **em memória**, configuração e usuário fictícios. Não lê
`DATABASE_URL`, não usa Hub/Connect reais e não salva dados do site. Credenciais
sintéticas estão no próprio fixture de teste. **Intercepte GA4 e Meta antes da
navegação no navegador de teste**, incluindo scripts e endpoints de coleta, para
que nenhum evento seja enviado a contas reais. Os testes desktop e 390px devem
cobrir: nenhuma chamada antes da autorização (inclusive com consentimento
preexistente), escolhas independentes, `load`, erro, prazo, revogação, configuração
desligada/inválida, falha na API e ausência de rastreadores no painel.
