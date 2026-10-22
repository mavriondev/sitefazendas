# Domínio Gramogol na Hostinger

Domínio principal: **fazendasgramogol.com.br**, com `www` redirecionado ao principal quando o HTTPS for ativado.

## Preparação, sem publicar o aplicativo

O servidor utiliza Debian, Nginx e PM2 e hospeda outros produtos. Não substituir
`nginx.conf`, o site padrão, os vhosts de outros produtos ou a lista de processos PM2.

O arquivo `nginx-http.conf` atende exclusivamente aos dois nomes deste domínio:

- responde **503** com `noindex` e `Retry-After`, sem servir outro site por engano;
- disponibiliza apenas o caminho de validação ACME para o futuro certificado;
- não depende do aplicativo ou de banco de dados e não altera dados existentes.

Instalação inicial (root, conferir se o vhost já existe antes de sobrescrever):

```sh
install -d -m 755 /var/www/fazendasgramogol-acme/.well-known/acme-challenge
install -m 644 deploy/hostinger/nginx-http.conf /etc/nginx/sites-available/fazendasgramogol
ln -s /etc/nginx/sites-available/fazendasgramogol /etc/nginx/sites-enabled/fazendasgramogol
nginx -t && systemctl reload nginx
```

Fazer backup do vhost antes de qualquer alteração posterior.

## DNS a configurar no provedor autoritativo

| Tipo | Nome | Destino |
| --- | --- | --- |
| A | `@` | IP público da VPS Hostinger |
| CNAME | `www` | `fazendasgramogol.com.br` |

Não alterar MX, SPF, DKIM ou outros registros de e-mail. Remover ou corrigir
registros A/AAAA conflitantes somente após confirmar seus destinos. Não criar
AAAA se o servidor não tiver IPv6 configurado para este site. Se houver CAA,
ele precisa permitir `letsencrypt.org`.

## Ativação posterior do site e do HTTPS

Esta preparação **não instala nem publica o aplicativo**. Antes de trocar o vhost:

1. Instalar a versão aprovada do projeto em diretório próprio, com banco PostgreSQL
   e uploads persistentes próprios. Não reutilizar bancos ou credenciais de outros produtos.
2. Configurar o processo com `NODE_ENV=production`, `PORT=5005` e
   `BIND_HOST=127.0.0.1`, `SITE_URL=https://fazendasgramogol.com.br`, além das variáveis obrigatórias do
   README principal. A porta 5005 deve permanecer fechada ao público; permitir
   acesso ao app somente pelo Nginx. Confirmar que a porta continua livre.
3. Validar `http://127.0.0.1:5005/api/saude`, a inicialização e a persistência
   antes de apontar o proxy para o processo.
4. Após ambos os nomes resolverem para a VPS e a porta 80 estar acessível, emitir
   certificado com e-mail do responsável e aceite explícito dos termos:

   ```sh
   certbot certonly --webroot -w /var/www/fazendasgramogol-acme \
     --cert-name fazendasgramogol.com.br \
     -d fazendasgramogol.com.br -d www.fazendasgramogol.com.br \
     --email EMAIL_DO_RESPONSAVEL --agree-tos
   ```

5. Conferir o certificado. Instalar `nginx-https.conf.template` como o vhost
   `fazendasgramogol`, validar `nginx -t` e só então recarregar Nginx.
6. Configurar deploy hook de renovação para `nginx -t && systemctl reload nginx`,
   verificar o timer do Certbot e executar `certbot renew --dry-run`.
7. Confirmar HTTPS válido, redirecionamentos de HTTP e `www`, login com cookie
   Secure, upload e os URLs de sitemap/compartilhamento. Não fazer cache no proxy
   de API, painel ou uploads privados.

Se a validação do novo vhost falhar, restaurar o backup antes de recarregar.
Nenhum certificado foi emitido como parte da preparação inicial.

## Segurança antes de liberar acesso público

- Usar usuário de sistema exclusivo para o aplicativo, sem root; arquivos de
  configuração privados e uploads fora de `dist/public`. O banco deve ter usuário
  próprio, sem privilégios de superusuário. Não expor PostgreSQL nem a porta 5005.
- Gerar `SESSION_SECRET` aleatório com pelo menos 32 bytes e não reutilizar
  credenciais de outros produtos. Nunca versionar `.env`, dumps ou documentos.
- Nginx deve ser o único proxy. Manter a sobrescrita de `X-Forwarded-For`
  deste template: o Express confia em exatamente um proxy para limitar por IP.
- Usar uma instância do app: os limitadores atuais são locais ao processo. Antes
  de habilitar PM2 cluster ou múltiplas réplicas, usar armazenamento compartilhado
  para limites. As sessões já são persistidas em PostgreSQL.
- HTTPS válido é obrigatório para cookies Secure. Conferir renovação automática,
  atualizações de sistema/Node suportado e backups **criptografados** do banco e
  dos uploads, com acesso restrito e teste periódico de restauração.
- Verificar login, logout, cadastro, troca de senha, contato e upload pelo domínio
  final. APIs não devem passar por cache/CDN com armazenamento de respostas.
- Não iniciar Vite/esbuild em modo servidor no ambiente público. Servir somente
  o build pelo Express. Consultar `SECURITY.md` para limites e alertas pendentes.
