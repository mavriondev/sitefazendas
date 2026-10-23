# Notícias e cotações na Gramogol

> **Publicação bloqueada:** o teste cruzado em navegador confirmou notícias,
> painel e dólar, mas o endpoint oficial dos widgets de commodities devolveu
> desafio HTTP 403 do provedor e os quadros ficaram vazios. O gerador do próprio
> portal funciona, o que não garante incorporação em outro domínio.
> Não publicar este PR antes de escolher uma fonte permitida e comprovar as
> quatro tabelas no site. Não contornar o desafio nem desligar o isolamento.

## Fontes e direitos
- **Ministério da Agricultura:** consulta a listagem pública e importa texto
  somente após conferir a licença CC BY-ND 3.0 na própria matéria.
  Conserva título, subtítulo, texto, fonte e link original. Imagens, vídeos e
  seus arquivos não são copiados. Sem a licença reconhecida ou com aviso
  restritivo no texto, publica apenas a apresentação.
- **Canal Rural:** lê o RSS oficial. Guarda título, autoria, data, URL e até
  220 caracteres da apresentação distribuída pelo feed. Não busca a íntegra
  nem importa `content:encoded`. A página identifica o trecho fornecido pela
  fonte; o administrador pode escrever um resumo editorial separado.
- Chamada e resumo editorial não substituem nem alteram o original licenciado.
  Uma reimportação conserva edições, ordem e ocultação feitas pelo administrador.
- Notícias usam canonical para o endereço original do publisher, evitando
  apresentar republicação como reportagem exclusiva da Gramogol.

Fontes: https://www.gov.br/agricultura/pt-br/assuntos/noticias
e https://www.canalrural.com.br/feed/.

## Preços brasileiros
- **Dólar:** série SGS 1 do Banco Central, PTAX de venda em R$/US$.
  Exibe a data do dado e a variação entre as duas últimas observações.
  Não é preço intradiário. Falhas conservam o último valor com aviso; ausência
  de dado não vira zero. Também sinaliza dado com mais de sete dias.
- **Soja, milho, café e boi gordo:** widgets oficiais disponibilizados em
  https://www.noticiasagricolas.com.br/widgets. São mercados físicos brasileiros:
  soja e milho por praça; café arábica tipo 6; boi, média SP a prazo.
  O próprio provedor apresenta unidades, praças e fechamento.
- Não copia séries do CEPEA, cuja licença padrão restringe uso comercial.
  Não substitui esses preços por futuros internacionais.
- O visitante precisa clicar em **Carregar cotações** antes da conexão externa.
  O quadro é isolado, sem acesso ao documento principal nem à sessão.
  CSP própria permite somente o script oficial de cotações e suas imagens;
  publicidade, pixels, conexões adicionais e subframes não são autorizados.
  **Desativar** remove o quadro. O link alternativo da fonte fica disponível.

## Funcionamento e painel
- Atualização automática, acionada pelas consultas públicas, com intervalo
  de 30 minutos. Requisições simultâneas compartilham a atualização.
  Falhas também respeitam esse intervalo; não há uma consulta por visitante
  a cada erro. O navegador consulta o cache do site a cada 15 segundos.
- **Painel → Notícias e cotações:** fontes, exibição das seções, atualização
  manual, edição da chamada/resumo/ordem e ocultação das notícias.
- **Conteúdo do site:** títulos e textos da home, página de notícias,
  ocultação e posição das seções. Novas seções entram sem apagar a ordem
  relativa nem os textos anteriormente editados.
- A importação usa somente URLs de fontes fixas. Não recebe URLs de coleta
  fornecidas por visitantes, não executa HTML dos artigos e rejeita XML
  com DTD/entidades, redirecionamentos e respostas acima de 2 MB.
- Não precisa de nova chave, contratação, cron nem serviço.
  Não consulta nem modifica Hub, Connect ou outros sistemas da VPS.

## Publicação futura
Esta alteração não publica automaticamente nem altera main. Após aprovação,
seguir o roteiro existente: backup verificado do banco/uploads/configuração,
instalação do release e reinício somente de `gramogol.service`.
A migração adiciona `site_noticias` e índice, sem apagar dados existentes.
As configurações e o cache usam chaves próprias na tabela do site.
Em rollback, voltar ao código anterior sem restaurar o banco inteiro por cima
de edições concorrentes. O código anterior simplesmente ignora a tabela nova.
