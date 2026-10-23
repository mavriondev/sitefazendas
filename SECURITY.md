# Segurança do portal

## Proteções e contrato de envio

- Toda mutação `/api` exige cookie de sessão e `X-CSRF-Token`, inclusive login,
  cadastro, contato, logout e uploads. Obter o token em `GET /api/auth/csrf`
  com o mesmo cookie. Tokens nunca devem ir na URL ou em logs.
- O cliente obtém um token antes de cada envio; sessões renovam no login,
  cadastro e troca de senha. Tokens anteriores deixam de valer.
- Sessões duram no máximo oito horas, com HttpOnly, SameSite=Lax e Secure em
  produção. Troca/redefinição de senha revoga as demais sessões; bloqueio de
  usuário também retira o acesso. Sessões anteriores a esta atualização exigem
  novo login. Links de redefinição são consumidos por atualização SQL atômica.
- Novas senhas: mínimo de 12 caracteres e máximo de 72 bytes UTF-8, evitando a
  truncagem silenciosa do bcrypt. Senhas antigas não são alteradas automaticamente.
- Limites: API 240 requisições/minuto/IP, autenticação 20 tentativas/15 minutos/IP,
  login também 20 falhas/15 minutos/conta, contato 10 envios/10 minutos/IP.
  São limites de processo, não uma defesa contra DDoS distribuído.
- JSON público até 16 KiB; administrador autenticado até 5 MiB para GeoJSON.
  Objetos, profundidade, chaves perigosas, IDs e campos públicos são validados
  no servidor. Formulários também limitam tamanhos no navegador.
- Uploads são restritos ao administrador, até 12 MiB, um arquivo por requisição,
  com limites de campos multipart. Apenas JPEG/PNG reconhecidos pelo conteúdo
  são aceitos; nomes são aleatórios e metadados sensíveis são removidos.
- Helmet/CSP restringem scripts, frames e origens. Texto é renderizado pelo React
  como texto, consultas usam parâmetros SQL e APIs enviam `Cache-Control: no-store`.
- Falhas async são encaminhadas ao tratamento central sem encerrar o processo.
  Respostas não incluem SQL, stack, senhas ou tokens. O retorno de login recusa
  destinos externos, barras invertidas e variantes codificadas.

## Verificação realizada em 2026-10-22

Varreduras SAST e de fluxo de dados não apontaram achados. Isso não substitui
pentest ou certificação. Há testes HTTP automatizados para CSRF, origem,
validação, excesso de tamanho, limites de envios, acesso administrativo, erros
de banco, sessões revogadas e uso concorrente de link de redefinição.

### Dependências ainda sinalizadas

O audit do lockfile standalone, somente dependências de produção, apresentou
**dois registros moderados**, relativos a React Router e seu pacote DOM:

- GHSA-wrjc-x8rr-h8h6: retorno de login sob controle do visitante foi protegido
  com validação estrita de caminho interno. Não aceitar caminhos arbitrários em
  futuras chamadas de `navigate` ou `Link`.
- GHSA-337j-9hxr-rhxg: hidratação SSR; o portal não usa SSR/hidratação de erros.

A correção publicada desses avisos exige React Router 7.18 ou superior. A versão
6 não foi trocada silenciosamente: migração de versão principal deve ser feita
com teste de navegação e aprovação. A mitigação local não remove o alerta do audit.

O scan do workspace também sinalizou ferramentas Vite 5/esbuild antigas e
`braces` transitivo. Os alertas de Vite são do servidor de desenvolvimento,
que **não é usado** pelo comando `dev` deste portal: ele compila e inicia Express.
Atualizar a cadeia de build em trabalho específico; não expor servidores de
desenvolvimento como solução de hospedagem. A contagem do workspace inclui o
sandbox, não apenas este produto.

## Operação e limites

Seguir `deploy/hostinger/README.md` antes da publicação. As mudanças de código
não ativam HTTPS, firewall, backups ou atualização de sistema na VPS.

Pendências recomendadas: MFA para administradores, monitoramento de eventos de
acesso com retenção e privacidade definidas, serviço antiautomação se houver
spam distribuído, atualização da cadeia de dependências e pentest independente
antes de operação com dados reais. Não há promessa de invulnerabilidade.
