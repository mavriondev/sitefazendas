# Analytics e Pixel pelo painel

Em **Painel → SEO → Geral → Analytics e Pixel**:

1. Para Google Analytics 4, copie o **ID de medição** (`G-…`) do fluxo Web. Não cole a tag HTML.
2. Para Meta, copie somente os números do **ID do Pixel** no Gerenciador de Eventos.
3. Ative separadamente os provedores desejados e salve o SEO.
4. Confira em uma janela sem escolhas de cookies anteriores: nenhum provedor deve
   carregar antes da autorização. IDs vazios ou inválidos não podem ser ativados.

Os IDs ficam no banco **do site**, junto ao SEO já existente. Não exigem variável
de ambiente, chave secreta, mudança de código, build ou reinício de serviço.
Novas visitas recebem a configuração atual; abas abertas verificam ao navegar,
voltar ao foco, receber aviso de outra aba ou a cada 30 segundos. Uma troca de ID
ou desativação pode recarregar a página para descartar bibliotecas já executadas.

## Consentimento

- Analytics autoriza somente GA4; marketing autoriza somente Meta.
- Aceitar e rejeitar têm igual destaque. Também é possível personalizar.
- A escolha fica no dispositivo por até 180 dias, inclusive quando rejeitada.
- O botão **Preferências de cookies** permite retirar a autorização a qualquer
  momento. Cookies conhecidos de rastreamento são removidos sem apagar a sessão.
- Painel, conta, login, pesquisa por CAR e ficha PDF não são medidos.
- Se a configuração não puder ser consultada ou for inválida, nenhum rastreador
  novo é iniciado; rastreadores já ativos são desabilitados com recarga da página.
- Não há scripts livres, pixels em `noscript`, pings anteriores ao consentimento,
  correspondência avançada ou envio intencional de campos de formulário.

## Preparar as contas

O site envia visualizações em navegações públicas. No GA4, desative a **medição
otimizada** do fluxo Web (incluindo cliques de saída, downloads de arquivos,
formulários e visualizações baseadas em mudanças do histórico).
Isso é necessário para evitar eventos paralelos, URLs de WhatsApp com telefone
e mensagem e duplicação de visualizações. Essa configuração pertence à conta GA4
e não é substituída pelo botão de ativação do painel. O site
envia a localização ao GA4 sem os parâmetros de busca ou fragmentos.

A biblioteca oficial da Meta usa metadados próprios de navegação conforme a
configuração da conta. Por isso, o site não inicia o Pixel nem envia suas
conversões em endereços com parâmetros de busca ou fragmentos. Não inclua
informações pessoais em URLs públicas. Mantenha eventos automáticos e
correspondência avançada desativados na conta da Meta.
Bloqueadores e configurações do navegador podem impedir a entrega dos eventos.
Confirme o recebimento nas ferramentas oficiais das respectivas contas.

Antes de ativar, revise a política de privacidade editável no painel e as
configurações e obrigações das contas dos provedores. Este controle técnico de
consentimento não substitui essa revisão.

## Interesse por fazenda

| Interação explícita | Evento no GA4 e evento personalizado na Meta | `origem` |
| --- | --- | --- |
| Clique no WhatsApp flutuante do anúncio | `whatsapp_click` | `whatsapp_flutuante` |
| Clique em TENHO INTERESSE | `whatsapp_click` | `tenho_interesse` |
| Clique em Gerar PDF da fazenda | `pdf_open` | `ficha_pdf` |

Os três enviam somente `fazenda_slug` (slug público) e `origem` como dimensões
do anúncio. GA4 recebe também `send_to`, a URL pública sem query/fragmento e
referrer vazio. Nenhum telefone, texto da mensagem, CAR, coordenada, URL de destino
ou campo de formulário é acrescentado ao evento. O compartilhamento via WhatsApp
não é contato com o corretor e não entra nessa contagem.

São medidas de **clique**, não de contato realizado, lead confirmado, venda ou
arquivo efetivamente salvo. `pdf_open` registra a intenção de abrir a ficha em
outra aba: não comprova que ela carregou ou que o visitante imprimiu/salvou.
Não há `Lead`, `Contact`, `Purchase` ou `file_download` emitidos pelo site.
O acesso direto à ficha PDF continua sem tags.

Consentimento válido de analytics libera apenas GA4; marketing libera apenas Meta.
Flags e IDs são os consultados dinamicamente pelo mecanismo existente. Cliques
antes da autorização, depois de expirar/retirar a escolha ou desativar o provedor
não são guardados para envio posterior. A mesma ativação do link é medida uma
vez por provedor, inclusive clique do meio; novas ativações intencionais contam
novamente. Falhas de um provedor não impedem o outro ou a navegação.

Para comparar anúncios no GA4, crie dimensões personalizadas com escopo de evento
para `fazenda_slug` e `origem` e use-as com a contagem dos eventos acima.
Na Meta, filtre os eventos personalizados pelos mesmos parâmetros. Não marque
esses cliques como contatos confirmados nos relatórios de negócio.

### Validação sem contaminar contas reais

- `npm test` inclui a suíte `conversoes`, que usa IDs fictícios e provedores
  em memória, cobre categorias isoladas, recusa, expiração, flags, troca de ID,
  duplicação, áreas privadas, payload restrito e provedor bloqueado.
- No navegador, intercepte `/api/public/rastreamento` para devolver IDs de teste
  (`G-TEST123456` / `123456789012345`). Intercepte os scripts oficiais e qualquer
  request Google/Meta, usando implementações falsas que capturem os comandos;
  nunca encaminhe essas requisições às contas.
- Confira que cada botão gera exatamente um evento por provedor autorizado,
  atribuído ao slug carregado, e que o link abre mesmo com os scripts abortados.
  Recarregar, voltar ao foco, compartilhar ou abrir a ficha diretamente não
  devem gerar conversões. Verifique a retirada da autorização e a configuração
  desativada com a mesma interceptação, sem editar o banco de produção.
