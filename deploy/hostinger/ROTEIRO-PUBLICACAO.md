# Roteiro curto — Hostinger Gramogol

**Documento apenas. Não executa publicação.** Exige autorização do responsável,
PR revisado e commit aprovado. Não alterar a main como etapa de publicação.
Hub e Mavrion Connect são somente consulta: não editar código, banco, configuração,
cron ou chaves deles, nem reiniciar seus serviços. Qualquer necessidade disso exige
parar e obter autorização prévia.

## 1. Preparar e salvar a versão anterior
- Registrar o commit instalado e o commit aprovado. Não usar `git pull` de uma branch
  em movimento como substituto de uma versão aprovada.
- Fazer backup protegido e consistente do **banco exclusivo do site**, dos uploads
  e da configuração privada; guardar fora da pasta pública e testar restauração.
  Não exportar bancos da Hub/Connect nem copiar dados de teste para produção.
- Preservar o conteúdo editado em produção. Não executar seed nem reimportar o banco
  do ambiente de desenvolvimento. Programar manutenção se necessário para a consistência.

## 2. Configuração do site — nomes de variáveis, sem valores
- Execução: `NODE_ENV`, `PORT`, `BIND_HOST`, `SITE_URL`.
- Obrigatórias: `DATABASE_URL`, `SESSION_SECRET`, `UPLOADS_DIR`.
- Somente no bootstrap de administrador novo: `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
  Não recriar o administrador existente nem manter senha de bootstrap sem necessidade.
- Integração opcional, reaproveitando o acesso existente: `HUB_API_URL`, `HUB_API_KEY`.
- Texto por IA opcional: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.

Usar `/etc/gramogol/runtime.json` com permissões restritas e o carregador
`deploy/hostinger/start.cjs`. Nunca versionar configuração, segredos, dumps ou uploads.
O banco e o usuário PostgreSQL são exclusivos da Gramogol; não são os da Hub/Connect.
Uploads persistem em `/var/lib/gramogol/uploads`, fora do código e de `dist`.

## 3. Instalar a versão aprovada
- Em diretório de release separado, obter o commit aprovado do repositório
  `mavriondev/sitefazendas`. Usar a versão suportada de Node e o lockfile do projeto.
- Executar `npm ci`, `npm run check`,
  `NODE_ENV=test npx tsx server/__tests__/run-all.ts` e `npm run build`,
  sem credenciais/banco de produção durante testes e compilação.
- Conferir o novo catálogo e o painel em homologação, no computador e em 390 px.
- Após autorização, trocar somente o código do site em `/opt/gramogol` para o release
  aprovado. Manter configuração e uploads. O início do app aplica seu esquema aditivo
  somente ao banco do site; revisar mudanças de esquema antes da atualização.
- Reiniciar **somente `gramogol.service`** depois do build completo, para não servir
  HTML antigo apontando para arquivos JavaScript removidos. Não usar PM2 global nem
  reiniciar serviços da Hub/Connect.

## 4. Domínio e HTTPS
- Domínio principal: **fazendasgramogol.com.br**. Preservar DNS de e-mail.
- Reutilizar o vhost exclusivo e o certificado existentes; HTTP e `www` devem
  redirecionar ao domínio principal com HTTPS válido.
- Conferir renovação do certificado e proxy para a porta interna do site, sem
  expor PostgreSQL, painel por HTTP ou a porta interna publicamente.
- Não substituir a configuração global do Nginx nem vhosts de outros produtos.
  Se algo exigir alteração em infraestrutura compartilhada, parar e pedir aprovação.
- Validar saúde, home, catálogo, detalhe, login/logout, edição, upload, CMS, SEO,
  sitemap e fontes/JavaScript. Confirmar cookies seguros e ausência de cache do painel/API.

## 5. Voltar atrás se houver falha
- Interromper novas edições, apontar apenas o site para o release anterior e
  reiniciar somente `gramogol.service`; conferir saúde e páginas públicas.
- Quando o esquema continuar compatível, manter banco e uploads atuais para não
  perder edições. Se a versão antiga for incompatível, restaurar banco e uploads
  do mesmo backup consistente **somente com autorização**, informando a possível
  perda de alterações posteriores ao backup.
- Não mexer na Hub/Connect ou na main para corrigir uma publicação do site.
