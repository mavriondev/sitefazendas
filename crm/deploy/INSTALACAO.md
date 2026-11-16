# Instalação futura do CRM na Hostinger

**Roteiro de instalação e manutenção.** Exige código revisado e autorização específica.
Não alterar ou reiniciar Hub, Mavrion Connect, Norion, Tato, PostgreSQL ou o site
existente. A inclusão de `/crm` no proxy compartilhado exige autorização prévia
própria; usar somente recarga suave autorizada, nunca reiniciar Nginx por causa deste roteiro.

## Configuração privada — nomes, sem valores

- `CRM_DATABASE_URL`: banco/usuário de escrita exclusivos do CRM.
- `CRM_SOURCE_DATABASE_URL`: usuário separado exclusivamente SELECT na base do site.
- `CRM_SESSION_SECRET`: segredo novo do CRM; não reaproveitar o do site.
- `CRM_DOCUMENTS_DIR`: diretório privado exclusivo, fora de qualquer raiz pública.
- `CRM_SITE_UPLOADS_DIR`: ponto de montagem privado das fotos, por exemplo
  `/var/lib/gramogol-crm/site-photos`, somente leitura pelo CRM.
- `CRM_SITE_URL`: origem HTTPS do site (`https://fazendasgramogol.com.br`).
- `CRM_ADMIN_EMAIL`, `CRM_ADMIN_PASSWORD`: apenas bootstrap do primeiro administrador;
  remover depois de verificar acesso, sem redefinir a conta.
- `CRM_PORT`, `CRM_BIND_HOST`: porta interna exclusiva e bind local; `PORT`, se definido
  pelo supervisor, tem precedência.
- `NODE_ENV`: produção.

Guardar fora do repositório em `/etc/gramogol-crm/runtime.json`, legível somente pelo
root e pelo grupo exclusivo do serviço. Nunca inserir credenciais em argumentos,
Git, PR, logs ou arquivos públicos. Não editar `/etc/gramogol/runtime.json` do site.

## Preparação isolada

1. Registrar o commit aprovado e os serviços ativos. Salvar backups privados do
   banco, documentos e runtime **do CRM**, quando já existirem. Registrar também
   proprietário, grupo e permissões do runtime separadamente das permissões 0600
   usadas para proteger sua cópia de backup.
2. Criar banco PostgreSQL com nome diferente do banco do site, usuário e serviço
   de sistema `gramogol-crm` próprios, sem privilégios nas tabelas do site.
   Isso só pode ser feito na implantação autorizada, nunca durante desenvolvimento.
3. Preparar a conta de origem sem privilégios de escrita nas tabelas `fazendas`,
   `fazenda_atributos`, `fazenda_fotos`, `contatos`, `apresentacoes`. Conceder somente
   CONNECT/USAGE/SELECT necessários. Não usar o proprietário do banco, superusuário,
   credenciais de Hub/Connect nem conta com associação a papéis de escrita.
   Conferir `has_table_privilege` e tentativa de escrita em ambiente descartável.
4. Liberar ao usuário do CRM somente leitura das fotos do site por ACL específica
   nos arquivos e na pasta de fotos, incluindo ACL padrão para novas fotos. Não
   adicionar esse usuário ao grupo editorial, pois isso pode expor o runtime do
   site. Preservar as ACLs anteriores para rollback. Se `setfacl` não estiver
   instalado, usar a biblioteca ACL já existente, sem instalar pacotes globais
   ou ampliar permissões gerais de outros produtos.
   Montar a pasta de fotos no espaço do serviço como somente leitura, usando
   `BindReadOnlyPaths` do template. Criar o ponto de montagem privado antes de
   iniciar o serviço. O processo não precisa atravessar o diretório privado
   original do site, que deve manter suas restrições.
   Criar diretório
   privado de documentos do CRM com dono `gramogol-crm`, modo 0700, fora dos uploads.
   Não modificar arquivos ou permissões de outros produtos para conseguir acesso.
5. Preparar novo release fora de `/opt/gramogol`, por exemplo sob
   `/opt/gramogol-crm-releases/`, apontando `/opt/gramogol-crm` ao release aprovado.
   Instalar com lockfile, executar verificações do CRM e do site e fazer
   `NODE_ENV=production npm run crm:build`, mantendo as dependências de
   desenvolvimento necessárias para compilar. Testes e build nunca recebem
   credenciais reais.

## Serviço, rota e validação

1. Adaptar os templates deste diretório, com nomes, usuário e porta exclusivos.
   O entrypoint só migra o banco do CRM. O serviço escuta apenas no endereço local.
2. Inicializar o serviço novo **somente quando autorizado**. O serviço atual
   `gramogol.service` não precisa de modificação nem reinício para hospedar o CRM.
3. Em uma janela autorizada para infraestrutura compartilhada, adicionar regra
   específica de proxy para `/crm` e `/crm/`, preservando o prefixo completo e
   repassando host/protocolo. Não encaminhar `/api`, `/uploads` ou `/admin` ao CRM.
   A aplicação trata suas APIs em `/crm/api`, suas páginas em `/crm` e assets
   em `/crm/assets`. Certificado e domínio HTTPS existentes são reaproveitados.
   Revisar configuração e aplicar apenas pelo procedimento aprovado do servidor.
   Após `nginx -t` e recarga suave, **aguardar a nova rota ficar pronta**: consultar
   `/crm/api/health` por HTTPS com tentativas limitadas e pausa curta, exigindo
   HTTP 200 e JSON `ok: true` antes de testar páginas, assets e login. A recarga
   pode retornar enquanto um worker antigo ainda responde 404. Não dispensar a
   validação nem tolerar erro persistente; só evitar rollback por essa janela
   curta de transição.
4. Validar health, login/logout e bloqueio, permissões entre duas contas,
   atualização da origem, importação repetida, contato/negociação/retorno,
   upload/download/remover documento e recusas anônimas/sem permissão.
   Conferir cookie Secure/HttpOnly/SameSite e `/crm` sem indexação.
5. Conferir computador/390 px e regressões do site público, painel, PDF, WhatsApp,
   notícias e dólar. Não criar cadastros fictícios no banco público durante essa
   validação. Não anunciar CRM publicado até essas verificações passarem.

## Atualizar e voltar atrás

Em atualizações, construir release separado, preservar banco/documentos privados,
registrar a versão e trocar apenas o symlink/serviço do CRM. Comparar serviços
persistentes protegidos; sessões efêmeras SSH não indicam reinício de produtos.

Se houver falha, restaurar o symlink anterior e a configuração do CRM, incluindo
metadados originais de dono/grupo/modo; conferir leitura pelo usuário do serviço
antes de reiniciar **somente o CRM**. Manter banco e documentos atuais quando o
esquema for compatível. Nunca restaurar backup sobre edições recentes sem avaliar
compatibilidade, explicar perda potencial e obter autorização.

Na primeira instalação, uma falha não exige rollback do site: não encaminhar
tráfego ao CRM, manter o restante do proxy intacto e avisar o responsável.
Backups automáticos externos e teste periódico de restauração devem ser configurados
separadamente antes de usar o CRM como única guarda de documentos.
