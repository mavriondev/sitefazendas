# Site de fazendas

Vitrine pública de fazendas + painel do corretor + (opcional) pesquisa de terras sobre a Hub API do Mavrion Connect.
Banco, chaves e domínio **próprios** — este projeto não compartilha banco com o Mavrion Connect.

## Regras de dados (não quebrar)
- Dado automático nunca vira "confirmado"; só o corretor confirma (vendedor, documento ou visita).
- "Não detectado" não prova ausência; falha de fonte = "sem dado".
- Só vai ao site o que o corretor marca como público; CAR, município, coordenadas e polígono nunca saem. A silhueta é opcional e sem escala.
- Fotos têm o GPS removido no envio.
- Pesquisa de terras: desligada por padrão; o interruptor vale no servidor (404 e nenhuma consulta à Hub).

## Variáveis de ambiente
| Nome | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | PostgreSQL NOVO deste site |
| `SESSION_SECRET` | sim (produção) | texto aleatório longo |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | 1ª execução | cria o admin (senha mín. 8; troque depois) |
| `HUB_API_URL`, `HUB_API_KEY` | para enriquecer/pesquisar | Hub (`https://api.mavrionconnect.com.br`); criar uma chave só para este site e acrescentá-la em `API_KEYS` da Hub |
| `ANTHROPIC_API_KEY` | para texto por IA | opcional (`ANTHROPIC_MODEL` ajusta o modelo) |
| `UPLOADS_DIR` | sim (produção, salvo App Storage) | pasta em disco PERSISTENTE das fotos |
| `PRIVATE_OBJECT_DIR` | opcional | só no Replit: usa o App Storage em vez de disco (exige `@google-cloud/storage`, já nas dependências); UPLOADS_DIR vira o prefixo dos objetos |
| `SITE_URL` | recomendado | endereço público (links de compartilhamento) |
| `PORT` | não | padrão 5000 |

## Fotos
Padrão: disco local (`UPLOADS_DIR`), funciona em qualquer servidor — faça backup da pasta. No Replit pode-se usar o App Storage (`PRIVATE_OBJECT_DIR`). Em ambos, fotos de fazendas não publicadas só o administrador acessa (no modo App Storage; no disco, os nomes são aleatórios e não listáveis).

## Contas e senhas
- Sem serviço de e-mail: quem esquece a senha pede um link ao corretor (WhatsApp); no painel, Usuários → "Link de nova senha" (uso único, 1 hora).
- Excluir usuário (LGPD) apaga a conta e anonimiza os contatos feitos por ela; registros de apresentação são mantidos.

## Mapa de região (opcional por fazenda)
Círculo de 12 km com centro deslocado 2–5 km (direção fixa e aleatória, guardada no banco). Nunca a posição real. Usa tiles do OpenStreetMap (permitidos no CSP).

## Rodar
```
npm install
npm run build
npm start
```
Tabelas são criadas sozinhas no início. Testes: `npm test` (usam banco em memória). Checagem de tipos: `npm run check`.

## Antes de divulgar
1. Preencher CRECI e WhatsApp em Painel → Configurações.
2. Revisar a política de privacidade (`client/src/pages/Privacidade.tsx`) com advogado.
3. Testar com uma fazenda real: cadastrar com CAR, "Buscar dados da Hub", conferir a prévia pública, publicar.
4. Só ligar a pesquisa de terras depois de testar a Hub com os dados corrigidos.
