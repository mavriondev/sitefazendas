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

O site envia visualizações em navegações públicas. No GA4, desative a medição
automática de formulários e de visualizações baseadas em mudanças do histórico
para evitar coleta automática indesejada e duplicação de visualizações. O site
envia a localização ao GA4 sem os parâmetros de busca ou fragmentos.

A biblioteca oficial da Meta usa metadados próprios de navegação conforme a
configuração da conta. Não inclua informações pessoais em URLs públicas.
Bloqueadores e configurações do navegador podem impedir a entrega dos eventos.
Confirme o recebimento nas ferramentas oficiais das respectivas contas.

Antes de ativar, revise a política de privacidade editável no painel e as
configurações e obrigações das contas dos provedores. Este controle técnico de
consentimento não substitui essa revisão.
