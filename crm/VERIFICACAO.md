# Verificação do CRM — 12/11/2026

Base standalone: `mavriondev/sitefazendas`, `main` em
`c1c3fb5802b9d35e6e448a953ffa9ea2a648ea03`.
Somente dados, contas e arquivos sintéticos, com duas bases PGlite isoladas.
Nenhuma conexão à VPS, ao banco real, à Hub, ao Connect ou a outros produtos.

## Comandos

- `npm run crm:check`: passou.
- `npm run crm:test`: passou, oito grupos de verificações.
- `npm run crm:build`: passou.
- `npm run check`: passou.
- `npm test`: passaram as 13 suítes originais, incluindo painel, SEO, ficha/PDF,
  rastreamento, apresentações, notícias e câmbio. Os testes negativos de segurança
  imprimem `[erro interno] Error` de forma intencional; saída final foi zero.
- `npm run build`: passou.

Os arquivos públicos do cliente, servidor do site, lockfile e configuração
existente foram comparados com a base e não foram modificados. No repositório
standalone, as alterações são a pasta `crm/`, scripts novos de CRM no `package.json`
e exclusão de seu build no `.gitignore`. O servidor de prévia do workspace é extra
e usa exclusivamente as fixtures; não é configuração de implantação.

## Navegador — computador e celular 390 × 844

Passagem única pela jornada de atendimento:

- Login, criação de membro e concessão de uma fazenda pelo administrador.
- Contato criado e editado pela interface, responsável e fazenda associados;
  dados preservados após recarregar, inclusive edição no celular.
- Negociação criada, filtros de etapa/retorno, alteração para Concluída e limpeza
  da data; persistência após recarregar.
- Documento PDF enviado pela interface, listado e baixado autenticado como
  attachment. Após sair, download retornou 401/JSON sem bytes do arquivo.
- Membro viu somente a fazenda liberada e o contato sob sua responsabilidade.
  Tentativa de abrir outra fazenda mostrou acesso negado/não encontrado.
- Aviso de telefone duplicado e confirmação explícita criaram dois cadastros
  separados, sem fusão silenciosa.
- `window.innerWidth=390`; listas e fichas sem rolagem horizontal global.
- Links de PDF e página pública foram conferidos, sem acessar o domínio fictício.
  Nenhum envio real por WhatsApp ou e-mail.

## Ajustes após a passagem

O teste apontou imagem branca: a fixture inicial era um PNG válido de **1×1 px**,
não uma falha de permissão ou de download. Ela foi substituída por paisagem
geométrica sintética de **800×450**; o teste automatizado confirma bytes e dimensões
no endpoint autenticado. Upload de PNG também passou após a substituição.

As capturas revelaram cabeçalho alto no celular: a primeira linha do grid agora
tem altura explícita de 64 px. Filtros passaram a quebrar linhas, sem esconder
opções em faixas horizontais. Rótulos técnicos foram traduzidos, booleanos passaram
a Sim/Não, área recebeu unidade ha e identificadores internos saíram dos atributos.
Esses ajustes foram confirmados por tipos, testes e build; não foi feita outra
passagem completa de navegador.

## Limites e observações

O navegador registrou dois erros genéricos 404 em capturas iniciais, sem URL.
Não se repetiram ao tentar capturar a requisição e não foi possível atribuí-los
com segurança. Foi adicionado favicon local embutido, sem depender de caminho
raiz ou rede externa; não se afirma que era a causa dos registros.

Os testes automatizados também cobrem tentativas de acesso a documentos de outra
conta, revogação/bloqueio, redefinição de senha, CSRF e origem cruzada, limitação de
login, tipos/tamanho de arquivos, idempotência, concorrência por versão e preservação
da origem. O adaptador PostgreSQL foi exercitado contra o esquema sintético real,
com simulação da resposta de privilégios; credenciais e PostgreSQL da VPS não foram
consultados. Sessões PostgreSQL persistentes, runtime e permissões do usuário de
sistema ainda exigem a futura validação de implantação.

Não houve merge, publicação, migração na produção nem reinício de serviço da VPS.
