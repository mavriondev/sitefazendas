# Materiais privados por fazenda

## Uso
- CRM → Fazendas → abrir uma fazenda → Materiais.
- Fotos e documentos do site são lidos na origem, sem cópia do catálogo e sem escrita no site.
- Envie originais MP4, MOV, WebM, PDF, JPEG ou PNG. Há progresso, cancelamento e repetição idempotente; conteúdo idêntico na mesma fazenda não gera outra cópia.
- Equipe com acesso à fazenda pode enviar, baixar e emitir links. Só autor/administrador remove um material próprio do CRM ou revoga um link emitido por ele. Arquivos do site não podem ser removidos pela central.
- Nada começa selecionado. Selecione exatamente os arquivos; “Todos” seleciona somente a categoria exibida. O pacote utiliza a seleção, não todo o cadastro.
- A ficha atual é uma página de impressão: abra, salve como PDF e envie esse arquivo se quiser incluí-lo num ZIP/link. Não se disfarça HTML de PDF e não se altera o PDF existente.
- A emissão exige revisar e autorizar o conteúdo. PDFs, fotos e vídeos podem conter dados privados, inclusive em seu próprio conteúdo/metadados: revise antes de liberar. O sistema não extrai nem certifica esses dados.
- O destinatário vê apenas tipos genéricos e tamanhos dos arquivos selecionados, sem nome da fazenda, município, proprietário, CAR, coordenadas, legenda ou nome interno.
- Qualquer portador do link pode acessá-lo até expirar/revogar. Revogar não apaga cópias já baixadas. A exclusão de um material cancela os links que o incluíam.
- O link pode ser copiado ao emitir/repetir a mesma solicitação. A lista não recupera URLs antigas; revogue e gere outro se o perder.

## Configuração futura — não executada nesta entrega
Novos nomes de variáveis (nenhum segredo ou valor real neste documento):
- `CRM_MATERIALS_DIR`: armazenamento persistente privado dos materiais da equipe, exclusivo do CRM; fora do release, uploads públicos, documentos do site e diretórios servidos por Nginx.
- `CRM_MATERIAL_VIDEO_MAX_MB`: limite por vídeo; padrão 250 MiB, teto 1024 MiB.
- `CRM_MATERIAL_FILE_MAX_MB`: limite por PDF/foto; padrão 12 MiB, teto 100 MiB.
- `CRM_MATERIAL_ZIP_MAX_MB`: limite por pacote/link; padrão 1024 MiB, teto 2048 MiB.
- `CRM_MATERIAL_FARM_QUOTA_MB`: quota de uploads ativos por fazenda; padrão 5120 MiB, teto 102400 MiB.

Continuam sendo usados `CRM_DATABASE_URL`, `CRM_SOURCE_DATABASE_URL`, `CRM_SESSION_SECRET`, `CRM_SITE_URL`, `CRM_SITE_DOCUMENTS_DIR` e `CRM_SITE_UPLOADS_DIR`. Estes dois últimos são somente leitura. Não copiar credenciais para Git, HTML, logs ou esta documentação.

Sem `CRM_MATERIALS_DIR`, o CRM continua funcionando e mostra aviso de envio indisponível. Arquivos do CRM precisam do mesmo diretório persistente configurado para serem baixados; fotos/documentos disponíveis na origem continuam somente leitura.

Antes de uma publicação autorizada:
1. Conferir espaço livre, quota, usuário Linux exclusivo e permissões. Raiz sem symlinks nem escrita de grupo/outros; novos diretórios 0700 e arquivos 0600. Permitir somente o serviço CRM escrever em sua pasta. Conservar o acesso somente leitura às duas pastas do site.
2. Ajustar **apenas** o bloco existente do CRM no proxy, se necessário: tamanho de corpo acima do limite do vídeo para incluir multipart (padrão precisa de pelo menos 251 MiB); desabilitar buffering de requisição/resposta nessa rota ou assegurar área temporária privada; ajustar timeouts para envios e downloads de até 15 minutos. Não modificar outros serviços. Qualquer recarga/configuração de infraestrutura exige autorização.
3. Manter HTTPS, `/crm/` encaminhado ao CRM e sem alias público para as pastas privadas. O novo HTML `/crm/compartilhar` é servido pelo próprio CRM; não requer catálogo público ou outro backend.
4. Não registrar corpo, `Authorization` ou cookies das rotas de compartilhamento; não acrescentar rastreamento à página externa. O token fica no fragmento `#` (não enviado no URL HTTP); vai em cabeçalho para ler e em corpo POST para download nativo, nunca em query/path.
5. Fazer backup consistente do banco **do CRM** e `CRM_MATERIALS_DIR`, além dos backups já existentes do site. Conferir restauração antes de trocar release. Migração é aditiva: duas tabelas e índices no CRM, sem migração de dados do site.
6. Atualizar release somente após aprovação e validar conta de teste, envio/download/ZIP, limite do proxy, expiração e revogação. Não executar comandos contra Hub/Connect ou outros serviços.
7. Se voltar um release, manter diretório e tabelas dos novos materiais; não apagar dados. Se restaurar **backup antigo do banco CRM**, revogar todos os links restaurados antes de reabrir acesso, pois a restauração pode desfazer revogações posteriores ao backup.

## Proteções e limites operacionais
- Autenticação existente, CSRF, ACL por fazenda e autor, bloqueio/redefinição de senha e perda de acesso invalidam compartilhamentos do emissor.
- Tokens fortes derivados por HMAC da chave privada do CRM e UUID único; somente SHA-256 do token é persistido. Solicitações iguais retornam o mesmo link, não outro registro.
- Validade de 1 a 30 dias; até 100 itens por pacote/link, até 500 uploads ativos por fazenda, quota de bytes, dois uploads simultâneos no processo (um por usuário), dois downloads simultâneos e até 15 minutos por download.
- Videos vão diretamente para temporários privados em disco, nunca para buffer inteiro. Validação de formato/estrutura e tamanho, SHA-256 e escrita exclusiva. Interrupções limpam apenas temporários próprios; nomes enviados nunca viram caminhos internos.
- Downloads/ZIP STORE usam blocos de 64 KiB, CRC, backpressure e handles abertos antes dos headers. Falha antes do envio recusa o pacote; falha durante streaming interrompe a resposta, sem emitir ZIP final aparentemente completo. Cancelamentos liberam vagas/handles.
- Revalidar link/usuário antes e durante o streaming; headers privados, no-store, noindex, no-referrer, nosniff e anexos. IDs de outra fazenda não dão acesso.
- Não há transcodificação, download de YouTube, varredura antivírus nem garantia de reprodução de qualquer codec interno. Os arquivos são anexos, não conteúdo HTML executado no site.
- Limites de concorrência/rate limit são por processo, adequados ao serviço único atual. Uma futura configuração multiprocesso precisará de limites compartilhados.

## Verificação
`npm run crm:check`, `npm run crm:test`, `npm run crm:build`.
O teste de materiais cobre dados sintéticos: formatos/tamanhos inválidos, CSRF, outra equipe e outra fazenda, repetição, seleção externa mínima, arquivos ausentes, falha da fonte, ZIP/CRC, expiração, revogação inclusive em streaming, perda de acesso, exclusão e upload/download interrompido/simultâneo. A conferência de interface cobre desktop e 390 px; vídeo pequeno conclui rápido demais para medir progresso intermediário.
