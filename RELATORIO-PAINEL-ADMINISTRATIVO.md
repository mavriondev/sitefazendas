# Gramogol Fazendas — relatório do painel administrativo

**Preparado em:** 22/10/2026  
**Finalidade:** fornecer contexto e orientar melhorias com auxílio do Claude.  
**Site:** https://fazendasgramogol.com.br  
**Painel:** https://fazendasgramogol.com.br/admin  
**Repositório:** https://github.com/mavriondev/sitefazendas  
**Branch para colaboração:** `claude/painel-administrativo`

## 1. Resumo e alcance deste relatório

O painel permite administrar os imóveis, conteúdo institucional, imagens, contatos,
slides, parceiros, usuários, configurações e metadados de SEO. É funcional, mas não
é um construtor visual livre nem um CRM completo.

Há diferenças de maturidade entre os módulos. Conteúdo e SEO têm controles de
rascunho, recuperação local e concorrência. Os demais módulos usam fluxos mais
simples, com oportunidades de melhorar consistência, organização e prevenção de
erros.

Este levantamento foi feito pela leitura das rotas, componentes e documentação.
**Não é um novo teste completo de navegação, auditoria de acessibilidade, pentest
ou garantia de ausência de defeitos.** Recomendações abaixo não devem ser confundidas
com falhas reproduzidas.

Nenhuma senha, token, e-mail de usuário, mensagem de cliente ou cópia de banco
acompanha o relatório. Não enviar esses dados ao Claude.

## 2. Contexto e decisões que devem ser preservadas

- O responsável quer editar textos, contatos e imagens pelo painel, incluindo
  ocultar e reordenar seções, e também gerenciar SEO.
- O destino de hospedagem é a **Hostinger**, não a Replit.
- A referência visual aprovada para o site público foi o tema Agrezen:
  https://preview.themeforest.net/item/agrezen-agriculture-organic-farm-wordpress-theme/full_screen_preview/60779615
- Melhorar o painel não autoriza redesenhar o site público ou trocar sua identidade.
- Na vitrine, a busca fica abaixo do slider, sem sobreposição. O filtro de relevo
  foi considerado desnecessário pelo responsável; não reintroduzi-lo na interface.
- A página de uma fazenda utiliza contato por WhatsApp, sem formulário de contato
  próprio. Não recolocar esse formulário.
- Atributos públicos devem continuar usando ícones e apresentação legível.
- Existem anúncios fictícios autorizados para demonstração, identificados como
  exemplos. Não apagar automaticamente nem apresentá-los como imóveis reais.
- Toda alteração deve ir para o Git. Não misturar outros projetos deste workspace
  no repositório standalone.

## 3. Branch, base e limites da colaboração

Foi escolhida como base a branch `ajustes-alinhamento-gramogol`, que contém a versão
atual aprovada e a documentação de implantação na Hostinger.

**Commit-base:** `770dd14fb64200cb2e2e90e83875e4def26d6cfb`.

A branch `claude/painel-administrativo` contém o projeto completo, e não uma cópia
isolada da pasta de telas. Isso é necessário porque o painel depende de autenticação,
APIs, validações, tipos compartilhados e persistência.

Regras para o trabalho:

1. Trabalhar nessa branch e abrir pull request para `ajustes-alinhamento-gramogol`.
2. Não integrar ou sobrescrever a `main` como efeito colateral.
3. Não fazer force-push.
4. Não publicar na Hostinger sem autorização específica.
5. Não importar novamente dados da prévia sobre o banco de produção.
6. Não remover campos ou funcionalidades existentes silenciosamente.
7. Separar mudança visual, correção funcional e migração de dados na descrição
   das alterações.

Criar a branch e adicionar este relatório **não altera o site em produção**.

## 4. Mapa funcional das oito áreas

| Área | Rota | Capacidades atuais | Limites e observações |
| --- | --- | --- | --- |
| Fazendas | `/admin` | Listagem, criação, edição, fotos, vídeos, atributos, destaque e publicação | Sem painel inicial de indicadores; listagem simples, sem busca, filtros ou paginação na tela |
| Contatos | `/admin/contatos` | Ler mensagens, abrir WhatsApp, marcar atendido/reabrir e registrar apresentações | Não é funil de vendas; contatos e apresentações limitados aos 500 registros mais recentes na API |
| Conteúdo do site | `/admin/conteudo` | Textos, logos, imagens, links, seções, visibilidade e ordenação | Editor de campos e blocos existentes, não editor livre de HTML/CSS |
| SEO e buscadores | `/admin/seo` | Metadados globais, por página e fazenda, imagens sociais e indexação | Não conecta contas de buscadores nem garante posições |
| Slides da home | `/admin/slides` | Cadastrar, editar, enviar imagem, definir destino, ativar, ordenar e remover | Organização por ordem numérica; oportunidade de facilitar reordenação e visualização |
| Parceiros | `/admin/parceiros` | Nome, logo, link, ordem, ativação e remoção | Cadastro específico, separado das imagens editoriais |
| Usuários | `/admin/usuarios` | Consultar contas, alterar nível, bloquear, excluir e gerar link de nova senha | Papel aparece na tabela, mas a tela não oferece um gerenciador de papéis/permissões granulares |
| Configurações | `/admin/config` | Nome, WhatsApp, contatos, Sobre, CRECI, Instagram e pesquisa de terras | Alguns campos salvam automaticamente; outros dependem de botões separados |

### 4.1 Fazendas: abas e operações

O editor usa `/admin/fazendas/:id` e possui cinco abas:

- **Dados:** título, slug, região pública, culturas, área, forma de exibir área,
  preço de exibição, descrição, destaque e preferências de mapa. Há também
  campos privados, como CAR, município, UF, coordenadas, polígono e notas internas.
- **Dados da terra:** atributos estruturados, estados de informação, fontes,
  observações, revisão manual e controle do que será público.
- **Fotos:** envio, legenda, ordem, capa e exclusão.
- **Vídeos:** gerenciamento de vídeos do YouTube; não é upload de arquivos de vídeo.
- **Publicação:** mudança de estado do anúncio, validações e ações de publicação.

O sistema modela rascunho, revisão, publicada, vendida e arquivada. A interface
precisa manter rótulos claros e refletir as regras reais do servidor, sem apenas
trocar a aparência de um status.

Há ações auxiliares para enriquecimento pelo CAR e sugestão de descrição por IA.
São **dependências externas opcionais**: existir botão ou endpoint não comprova
que o serviço esteja configurado e disponível na produção. A sugestão de texto
exige revisão e salvamento; não deve publicar automaticamente.

Dados de cadastro privados não devem vazar pela API pública. A exibição de mapa
ou região é uma decisão explícita do cadastro e precisa continuar respeitando
as regras de divulgação existentes.

### 4.2 Conteúdo do site

O registro editorial inclui:

1. Marca, menu e rodapé.
2. Página inicial.
3. Sobre.
4. Parceiros.
5. Contato.
6. Venda sua fazenda.
7. Catálogo de fazendas.
8. Página de uma fazenda.
9. Textos dos formulários.
10. Política de privacidade.

Permite editar campos registrados, restaurar padrões, escolher/enviar/remover
imagens, ocultar e mover blocos existentes.

Cuidados:

- Os textos principais de Sobre, contatos e dados da marca ainda estão em
  Configurações; títulos e imagens dos slides têm tela própria.
- Cabeçalho e rodapé têm organização separada; créditos permanecem ao final.
- A busca não pode preceder o slider quando os dois estão visíveis.
- Campos obrigatórios e validações dos formulários não são removíveis pelo CMS.
- Há revisão otimista: conflito de edição retorna `409`, preservando o rascunho.
- Rascunhos são locais à sessão do navegador, não um histórico permanente no servidor.
- Uma imagem enviada só se torna pública quando referenciada em conteúdo salvo.
  Se a referência continuar em uma seção oculta, ela continua sendo referência salva.
- Uma imagem ainda referenciada não pode ser excluída.

### 4.3 SEO e buscadores

Permite configurar:

- Origem HTTPS oficial, título, descrição e imagem padrão.
- Código público de verificação do Google e Bing.
- Título, descrição, imagem e exclusão da indexação por página e imóvel.
- Bloqueio geral de indexação, com confirmação.
- Prévias aproximadas, contagem de caracteres e biblioteca própria de imagens.
- Rascunho local e conflito de revisão.

O servidor entrega metadados no HTML inicial: título, descrição, canonical,
robots, Open Graph, Twitter Cards, verificações e JSON-LD básico de página.
A navegação React também atualiza esses dados.

O corpo inteiro das páginas **não foi migrado para SSR**. O sitemap inclui somente
páginas indexáveis e imóveis publicados. Imóveis não publicados não devem revelar
seu conteúdo nem sua imagem privada por meio do SEO.

Alterar o domínio no painel não altera DNS ou certificados. Verificação de
buscador não é integração com Search Console. `noindex` não é autenticação.

### 4.4 Contatos, apresentações e usuários

- Contatos distinguem origens como contato institucional, venda de imóvel,
  pesquisa e vínculos com anúncios.
- O atendimento tem estados simples: novo e atendido.
- Apresentações registram comprador, contato, fazenda ou pesquisa, canal,
  observação e data. A interface pede o ID da fazenda manualmente.
- A tela de usuários permite níveis aberto, desbloqueado e completo para o
  módulo de pesquisa. Esses níveis não equivalem a permissões administrativas.
- Links de redefinição são de uso único e têm prazo de uma hora.
- Exclusão de conta possui confirmação e tratamento de anonimização de contatos.
  Preservar as proteções existentes contra ações administrativas indevidas.

## 5. Avaliação franca: prioridades de melhoria

### Prioridade alta — clareza e prevenção de erros

1. **Padronizar salvamento e feedback.** Explicitar o que salva automaticamente,
   o que está pendente e o que já foi publicado. Tratar carregamento, erro, vazio,
   sucesso e envio em andamento em todos os módulos.
2. **Evitar perda de edição.** Levar aos módulos antigos um aviso consistente ao
   sair com mudanças. Não confundir isso com histórico de versões.
3. **Melhorar publicação de imóveis.** Explicar impedimentos, separar salvar de
   publicar e confirmar ações destrutivas.
4. **Organizar o caminho editorial.** Deixar claro em qual tela editar marca,
   contatos, Sobre, slides, conteúdo e SEO. Hoje há distribuição entre módulos.
5. **Revisar mobile e acessibilidade.** Conferir tabelas, abas, menus, selects,
   foco, labels, teclado e largura dos formulários. Não presumir que todas as
   telas têm o mesmo tratamento responsivo.

### Prioridade média — produtividade

6. Adicionar busca, filtros por status e paginação reais nos cadastros,
   acompanhados de suporte na API quando necessário.
7. Trocar o ID manual de fazenda no registro de apresentação por seleção
   pesquisável, mantendo compatibilidade com a API.
8. Facilitar ordenação de fotos, slides e parceiros com controles acessíveis;
   arrastar não deve ser o único meio de reordenar.
9. Aproximar padrões visuais de espaçamento, ícones, títulos, ações e campos,
   sem alterar a identidade pública aprovada.
10. Reforçar a distinção visual entre informação pública, privada, estimada e
    confirmada. Não apresentar dados de modelos como medição em campo.

### Evoluções separadas, que não devem ser prometidas como existentes

- Histórico editorial permanente com restauração e trilha de auditoria.
- MFA para administradores.
- Backups externos criptografados com teste de restauração.
- Permissões administrativas granulares por função.
- Monitoramento operacional e de acessos com política de retenção.
- Migração planejada das dependências com alertas documentados.

Não há diagnóstico reproduzido neste relatório que justifique reescrever o
projeto inteiro ou trocar framework, banco, autenticação ou infraestrutura.

## 6. Arquitetura para localizar o código

**Stack:** React 18, React Router 6, Vite 5, TypeScript, Express 4, PostgreSQL,
sessões persistentes e uploads em disco.

Os caminhos abaixo são relativos à raiz do repositório standalone. Neste workspace,
o mesmo produto está em `artifacts/sitefazendas/`.

| Caminho | Responsabilidade |
| --- | --- |
| `client/src/App.tsx` | Rotas públicas e administrativas |
| `client/src/admin/AdminLayout.tsx` | Proteção visual e navegação das oito áreas |
| `client/src/admin/FazendasAdmin.tsx` | Listagem e criação de fazendas |
| `client/src/admin/FazendaEditor.tsx` | Editor e abas do imóvel |
| `client/src/admin/VideosAdmin.tsx` | Vídeos dentro do editor |
| `client/src/admin/ContatosAdmin.tsx` | Atendimento e apresentações |
| `client/src/admin/UsuariosAdmin.tsx` | Contas, níveis e recuperação |
| `client/src/admin/SlidesAdmin.tsx` | Slides |
| `client/src/admin/ParceirosAdmin.tsx` | Parceiros |
| `client/src/admin/ConfigAdmin.tsx` | Configurações gerais |
| `client/src/admin/ConteudoAdmin.tsx` e `.css` | Editor editorial |
| `client/src/admin/SeoAdmin.tsx` e `.css` | Editor de SEO |
| `client/src/api.ts` | Chamadas HTTP e tratamento de CSRF |
| `client/src/contexto.tsx` | Estado de sessão e conteúdo compartilhado |
| `client/src/components/Conteudo.tsx` | Aplicação do conteúdo no site |
| `client/src/components/SeoPagina.tsx` | Atualização de metadados na navegação |
| `shared/conteudo.ts` | Registro dos campos, páginas, limites e padrões |
| `shared/seo.ts` | Contratos e padrões de SEO |
| `server/app.ts` | Middlewares, proteção administrativa, uploads e HTML |
| `server/auth.ts` e `server/routes/auth.ts` | Autenticação e senhas |
| `server/routes/admin.ts` | CRUD administrativo principal |
| `server/routes/conteudo.ts` e `server/lib/conteudo.ts` | Persistência e validação editorial |
| `server/routes/seo.ts` e `server/lib/seo.ts` | Persistência, validação e geração SEO |
| `server/lib/seguranca.ts` | CSRF e funções de segurança |
| `server/schema.ts` | Migrações idempotentes |
| `server/__tests__/` | Testes unitários e HTTP |
| `deploy/hostinger/` | Serviço, inicialização, Nginx e operação |

APIs principais:

- `/api/admin/fazendas` e `/api/admin/fazendas/:id`, com subrotas de atributos,
  status, fotos, vídeos, enriquecimento e texto.
- `/api/admin/fotos/:fotoId`.
- `/api/admin/slides`, `/api/admin/parceiros`, `/api/admin/config`.
- `/api/admin/usuarios` e subrotas de edição, exclusão e link de senha.
- `/api/admin/contatos` e `/api/admin/apresentacoes`.
- `/api/admin/conteudo` e `/api/admin/conteudo/midias`.
- `/api/admin/seo`, `/api/admin/seo/fazendas` e `/api/admin/seo/midias`.
- `/api/auth/csrf`, `/api/auth/entrar`, `/api/auth/sair` e `/api/auth/eu`.

Consultar os arquivos para métodos e formatos exatos; não inventar novos contratos
apenas para fazer a interface parecer concluída.

## 7. Segurança e privacidade que não podem regredir

- Autorização administrativa também no servidor, não apenas no React.
- CSRF em operações de escrita; não substituir o cliente HTTP por chamadas que
  ignorem token, cookies e tratamento de erro.
- Cookies de sessão HttpOnly, SameSite e Secure em produção; revogação de acesso
  e regras de senha devem continuar funcionando.
- Limitação de tentativas e validação de campos, tamanhos, IDs e permissões.
- Upload administrativo JPEG/PNG até 12 MiB, saneamento e nomes aleatórios;
  não abrir upload arbitrário de SVG, HTML ou executáveis.
- Manter proteção das imagens de anúncios e conteúdos não publicados.
- Não remover CSP/Helmet para contornar erro visual.
- Textos editoriais e metadados não aceitam scripts executáveis.
- Não expor CAR, notas, localização ou dados pessoais em respostas públicas,
  mensagens de erro, analytics ou exemplos.
- Conteúdo e SEO usam revisão; preservar conflitos `409` e referências de mídia.
- Segredos, dumps, uploads privados e links reais de recuperação não vão ao Git.
- SEO não é controle de acesso, e a remoção de uma imagem não apaga caches externos.

O arquivo `SECURITY.md` registra limites e alertas de dependências conhecidos.
Ele deve ser consultado; este relatório não apresenta um audit atualizado.
Não migrar versões principais silenciosamente para eliminar um aviso.

## 8. Ambiente e implantação

O aplicativo de produção roda na Hostinger com serviço próprio, banco exclusivo
e uploads persistentes. Nginx fornece HTTPS e encaminha ao Express em interface
local. Há outros produtos na VPS: não alterar serviços ou sites deles.

O banco e os arquivos da produção já podem receber alterações reais pelo painel.
Uma nova versão de código **não deve reinicializar dados, reexecutar carga de
exemplos, substituir uploads ou restaurar o banco da prévia**.

Guia operacional: `deploy/hostinger/README.md`.

Para desenvolvimento independente, consultar `README.md` para as variáveis
obrigatórias. Utilizar banco e diretório de uploads de teste, separados da produção.

```sh
npm ci
npm run check
npm test
npm run build
```

Os testes existentes usam infraestrutura própria de teste. Confirmar a configuração
antes de executar scripts adicionais. Nunca usar produção como banco de teste.

## 9. Critérios de aceite para os ajustes do Claude

- [ ] As oito áreas continuam acessíveis ao administrador.
- [ ] Visitante e usuário comum não conseguem ler ou modificar APIs administrativas.
- [ ] Criar, editar, salvar, publicar, despublicar e excluir respeitam as regras.
- [ ] Falha de API não é apresentada como sucesso e não apaga o que foi digitado.
- [ ] Botões impedem envios duplicados quando apropriado.
- [ ] Mudanças editoriais aparecem no site somente após salvar.
- [ ] Reordenar/ocultar não quebra cabeçalho, slider, busca, rodapé ou página de imóvel.
- [ ] Referências de imagens, privacidade e exclusão continuam consistentes.
- [ ] Conflitos de conteúdo e SEO preservam o rascunho.
- [ ] SEO correto após acesso direto e navegação interna; sem vazamento de rascunhos.
- [ ] Desktop e celular sem controles cortados ou rolagem horizontal involuntária.
- [ ] Navegação por teclado, foco, labels e estados de carregamento conferidos.
- [ ] Nenhum texto editorial novo fica somente no código se precisar ser gerenciado.
- [ ] Tipos, testes e build passam; documentar o que não foi verificado.
- [ ] Nenhuma mudança em produção ou na main sem autorização.

## 10. Prompt pronto para enviar ao Claude

> Você vai ajudar a melhorar o painel administrativo da Gramogol Fazendas.
> Use o repositório https://github.com/mavriondev/sitefazendas, branch
> `claude/painel-administrativo`, e leia primeiro este relatório, README.md,
> CONTEUDO-DO-SITE.md, SEO-DO-SITE.md e SECURITY.md.
>
> Quero um painel mais organizado, consistente, fácil de usar e seguro, mantendo
> todas as funcionalidades existentes e o controle editorial pelo administrador.
> Comece identificando problemas concretos no código e nos fluxos. Separe defeitos
> reproduzidos de sugestões. Apresente uma proposta objetiva de ajustes antes de
> grandes mudanças.
>
> Priorize salvamento e prevenção de perda de edição, organização da navegação,
> formulários, selects, tabelas, uso no celular, acessibilidade, publicação de
> imóveis e clareza sobre o que é público ou privado.
>
> Não reescreva o projeto inteiro. Não altere a identidade do site público, não
> troque stack ou autenticação sem aprovação, não remova funcionalidades e não
> desative proteções de segurança. A hospedagem é na Hostinger, com banco e uploads
> próprios. Não use dados reais de clientes para testes.
>
> Trabalhe somente nessa branch, preserve os dados, execute as verificações
> pertinentes e abra pull request para `ajustes-alinhamento-gramogol`, explicando
> mudanças, testes e limitações. Não faça merge na main e não publique em produção
> sem minha autorização.
