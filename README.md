# Site de fazendas

Vitrine pública de fazendas + painel do corretor + (opcional) pesquisa de terras sobre a Hub API do Mavrion Connect.
Banco, chaves e domínio **próprios** — este projeto não compartilha banco com o Mavrion Connect.

## Páginas
Início, Fazendas (catálogo com filtros avançados: região, cultura, área, altitude, argila, relevo, água, energia, ordenação e paginação), Sobre, Parceiros (logos), Venda sua fazenda (com ou sem CAR), Contato, Pesquisa de terras (se ligada), Entrar/Cadastrar, Minha conta e Política de privacidade. O menu fica sempre visível no topo.
Painel: fazendas, contatos (origem: fazenda, pesquisa, contato, quer vender), slides, parceiros, usuários e configurações (inclui os textos de Sobre e Contato).
Os filtros do catálogo só enxergam dados públicos e agem sobre as mesmas faixas mostradas nos anúncios (não revelam o valor exato).

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
| `UPLOADS_DIR` | sim (produção) | pasta em disco PERSISTENTE das fotos |
| `SITE_URL` | recomendado | endereço público (links de compartilhamento) |
| `PORT` | não | padrão 5000 |

## Fotos
Ficam em disco (`UPLOADS_DIR`), sem dependência de nenhum provedor: faça backup dessa pasta. Fotos de fazendas não publicadas só o administrador abre; as publicadas têm cache de 1 dia. O GPS é removido no envio.

## Contas e senhas
- Sem serviço de e-mail: quem esquece a senha pede um link ao corretor (WhatsApp); no painel, Usuários → "Link de nova senha" (uso único, 1 hora).
- Excluir usuário (LGPD) apaga a conta e anonimiza os contatos feitos por ela; registros de apresentação são mantidos.

## Apresentação pública e sigilo
O design baseado no Agrezen usa fotografias, cartões de portfólio e ícones específicos dos atributos. A página da fazenda não exibe formulário de contato, mapa ou polígono: o contato é direto pelo WhatsApp configurado no anúncio ou pelo padrão do site. Coordenadas, CAR e geometria continuam disponíveis apenas para o trabalho interno e as regras existentes de enriquecimento.

A home respeita slides, destaques, parceiros e textos configurados no painel. As fotos decorativas fornecidas com o design são ilustrativas; os cartões e galerias dos anúncios usam exclusivamente as fotos cadastradas para cada fazenda. As fontes abertas Instrument Sans e Nunito Sans são servidas localmente, com suas licenças OFL.

## Vídeos do YouTube
No painel, abra uma fazenda e a aba **Vídeos**. É possível adicionar, editar título/link/ordem, retirar da exibição pública e remover vídeos. O menor número de ordem aparece primeiro. Novos vídeos são **privados por padrão**.

Só marque a autorização pública depois de revisar imagens, áudio, descrição e canal no YouTube. Vídeos podem revelar localização ou proprietário mesmo que o título seja neutro. O sistema bloqueia títulos públicos com dados privados conhecidos, mas não consegue revisar o conteúdo audiovisual automaticamente.

A tabela `fazenda_videos` é criada de forma aditiva no próximo início do servidor; nenhuma fazenda ou foto é apagada. Só vídeos autorizados de fazendas publicadas aparecem na API pública. O banco guarda o ID validado, não HTML nem iframe arbitrário. Players usam `youtube-nocookie.com` e só são carregados depois do clique; miniaturas públicas são fornecidas pelo YouTube.

## Rodar
```
npm install
npm run build
npm start
```
Tabelas são criadas sozinhas no início. Testes: `npm test` (usam banco em memória). Checagem de tipos: `npm run check`.

### Dados de exemplo (só desenvolvimento)
`NODE_ENV=development npm run seed:exemplo` cria 6 fazendas publicadas, 3 slides, 4 parceiros (logos de exemplo) e os textos de Sobre e Contato, todos marcados com `[EXEMPLO]`. Rodar de novo recria os exemplos sem duplicar; `NODE_ENV=development npm run seed:exemplo -- --remover` apaga só eles. O script recusa qualquer `NODE_ENV` diferente de `development` e nunca altera dados reais nem textos já editados no painel.

## Antes de divulgar
1. Preencher CRECI e WhatsApp em Painel → Configurações.
2. Revisar a política de privacidade (`client/src/pages/Privacidade.tsx`) com advogado.
3. Testar com uma fazenda real: cadastrar com CAR, "Buscar dados da Hub", conferir a prévia pública, publicar.
4. Só ligar a pesquisa de terras depois de testar a Hub com os dados corrigidos.
