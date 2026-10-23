# Revisão funcional e de sigilo

## Escopo

Revisão dos fluxos públicos e administrativos, contratos das APIs, autenticação/
autorização, publicação, atributos, fotos e uploads, slides, compartilhamento,
rascunhos e ações dos formulários. Foram considerados também os testes de
conteúdo, SEO, filtros, vídeos, dados oficiais, PDF e consentimento.

Não é uma certificação de ausência de erros nem um teste de invasão completo.
Nenhuma escrita de teste foi feita na produção, na Hub ou no Connect.

## Defeitos corrigidos

1. **Upload de foto publicada:** a legenda agora passa pela guarda de sigilo
   antes de criar arquivo ou registro. Falha no INSERT remove o arquivo novo.
2. **Atributos públicos:** validação do estado candidato antes do único
   INSERT/UPDATE. Uma resposta 409 não salva parcialmente nem altera o valor
   anterior. Campos opcionais com tipos inválidos recebem 400, não 500.
3. **Defesa na leitura:** legendas e textos de atributos incompatíveis com o
   sigilo atual não aparecem na projeção pública, inclusive em dados legados.
4. **Slides vinculados:** rascunhos e fazendas arquivadas não aparecem na home
   nem liberam a imagem do slide ao visitante. Textos vinculados são verificados
   na escrita e novamente na leitura pública.
5. **Endereço público:** o título original de um rascunho podia deixar o município
   no slug mesmo depois de corrigir o título. Antes da primeira publicação, a
   edição saneia esse endereço. A publicação também valida o slug. Não há
   renomeação em massa nem mudança automática de links já publicados.
6. **WhatsApp:** distingue DDD nacional 55 do código internacional +55 e rejeita
   comprimentos inválidos, mantendo a mensagem codificada.
7. **Envios repetidos:** a trava de ação agora permanece ativa durante toda a
   pausa de 450 ms, não só durante a requisição.
8. **Rascunho após salvar:** só a versão salva é removida do armazenamento da
   aba. Erro no salvamento ou digitação posterior não apagam o rascunho.
9. **Números ausentes dos dados oficiais:** strings vazias ou só com espaços
   agora são `null`, não zero. Ajuste apenas no leitor do site, sem mudar a Hub.
10. **Teste de sigilo instável:** hashes aleatórios de arquivos e o sufixo
   aleatório do slug não são confundidos com valores privados; o conteúdo e
   nomes dos campos continuam inspecionados. A expectativa de slide arquivado
   foi atualizada: o slide inteiro deve sair, não apenas perder o link.

## Verificação

- Checagem de tipos e build do cliente/servidor.
- Onze suítes automatizadas, incluindo a nova `revisao`.
- Regressões com banco PGlite, uploads temporários e dados fictícios:
  legendas com município/CAR/coordenadas, atributos recusados sem escrita,
  tipos inválidos, slides/imagens privados, leitura de registros legados,
  saneamento do slug e telefones com DDD 55.
- Conferência de navegador dos fluxos administrativos alterados e da vitrine.

O log `[erro interno] Error` da suíte de segurança pertence a um teste negativo
intencional. Não representa erro em uma requisição normal.

## Publicação

Sem novas dependências, variáveis de ambiente ou mudanças de esquema.
Backup e restauração isolada devem ser verificados antes da troca de release.
Reiniciar somente `gramogol.service`. Preservar banco, uploads e configuração
privada; em falha, voltar o código ao release anterior sem sobrescrever edições
concorrentes do painel.
