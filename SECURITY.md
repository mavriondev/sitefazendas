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

## Auditoria de dependências em 2026-11-17

Escopo: `package.json` e `package-lock.json` standalone, a partir da branch
`release/gramogol-atualizacao-completa-20261116` do repositório
`mavriondev/sitefazendas`. Não inclui dependências de outros artefatos do
workspace. A auditoria inicial reproduziu **7 registros: 1 baixo, 3 moderados
e 3 altos**; registros são pacotes sinalizados, não sete falhas independentes.

Após as correções, `npm audit --json` e `npm audit --omit=dev --json`
retornaram **zero vulnerabilidades conhecidas**, incluindo as ferramentas de
build no primeiro comando. Isso é um retrato do registro de avisos consultado,
não uma garantia de ausência de vulnerabilidades. Não foram repetidas as
varreduras SAST/fluxo de dados históricas citadas acima.

### Alcance na aplicação e correções

| Pacote no lockfile | Antes → depois | Alcance e decisão |
| --- | --- | --- |
| body-parser | 1.20.8 → 1.20.9 | Alto, GHSA-27r3-jxmh-p828: DoS ao processar corpos comprimidos. Express usa o parser no site e no CRM; JSON é processado em rotas públicas também. CSRF e limites de tamanho não substituem o patch. Atualização transitiva dentro da faixa já aceita por Express 4.22.3, sem override. |
| multer | 2.4.0 → 2.5.0 | Alto, GHSA-q7qp-rjg7-q26m: DoS com `fileFilter` assíncrono pendente após encerramento da requisição. O portal só aceita uploads autenticados no painel e não configura esse filtro assíncrono; o CRM não recebe uploads. Menor exposição nessa configuração, mas o pacote foi corrigido. |
| fast-xml-parser | 5.11.2 → 5.12.1 | Baixo, GHSA-474x-hrwr-fgx4: CPU quadrática em stop-node não terminado. Usado em RSS de fonte externa permitida, sem configurar `stopNodes`; não é XML arbitrário enviado pelo visitante. Patch da mesma versão principal. |
| react-router / react-router-dom | 6.30.6 → 7.18.5 | Moderados, GHSA-wrjc-x8rr-h8h6 e GHSA-337j-9hxr-rhxg: links/redirecionamento e hidratação SSR. O código entregue ao navegador do site/CRM contém o roteador. O retorno de login já usa validação estrita de caminho interno e não há hidratação SSR de erros. A linha 6 não tem correção disponível para esses avisos; migração explícita para a linha 7, mantendo React 18. |
| vite | 5.4.21 → 6.4.6 | Alto agregado, inclusive via esbuild: exposição de arquivos no servidor de desenvolvimento, editor/execução no Windows e middleware. Não participa do servidor de produção, que serve o build pelo Express. A linha 6.4 corrigida evita saltar desnecessariamente para Vite 8. |
| esbuild | 0.24.2 → 0.25.12 | Moderado, GHSA-67mh-4wv8-2f99: acesso cross-origin ao servidor de desenvolvimento. Usado como compilador CLI, não servidor; foi corrigida tanto a dependência direta quanto a trazida por Vite. |

Os mínimos de Express e do plugin React foram alinhados às versões compatíveis
já presentes no lockfile (4.22.3 e 4.7.0). As demais atualizações transitivas
decorrem dessa resolução; não foi usado `npm audit fix --force` nem override
para ocultar os alertas.

### Instalação e validação isoladas

- Node 24.22.1 no ambiente de validação; React Router 7 exige Node >=20.
  Continuar com a linha Node 22 ou superior compatível com as dependências do
  portal; não instalar em Node 18.
- Instalação limpa com `npm ci`, integridades preservadas e todos os URLs
  `resolved` no registro público `https://registry.npmjs.org/`, sem dependência
  de endereços internos do workspace. O lockfile permaneceu idêntico após o CI.
- Tipos: `npm run check` e `npm run crm:check`.
- Testes sintéticos: `npm test` (17 grupos) e `npm run crm:test`. Banco PGlite
  descartável, sem credenciais nem dados de produção no ambiente.
- Builds: `npm run build` e `npm run crm:build`; ambos aprovados. Avisos de
  tamanho de bundle não substituem validação de segurança. Os builds finais
  usam `NODE_ENV=production` com ambiente isolado, sem banco ou segredos reais.
- Na migração, o teste de navegador encontrou dois redirecionamentos concorrentes
  depois do login no CRM. O retorno agora é decidido somente pela rota
  autenticada, usando a mesma validação de caminho interno do portal, em vez de
  combinar navegação imperativa no login com um segundo redirecionamento.
- Manter a validação estrita de destinos internos em futuras chamadas de
  `navigate`/`Link`, mesmo com o roteador atualizado.

A instalação dessas correções em produção exige revisão e autorização separada.
Este trabalho não altera a `main`, não publica e não acessa o banco de produção.

## Operação e limites

Seguir `deploy/hostinger/README.md` antes da publicação. As mudanças de código
não ativam HTTPS, firewall, backups ou atualização de sistema na VPS.

Pendências recomendadas: MFA para administradores, monitoramento de eventos de
acesso com retenção e privacidade definidas, serviço antiautomação se houver
spam distribuído, acompanhamento contínuo das dependências e pentest independente
antes de operação com dados reais. Não há promessa de invulnerabilidade.
