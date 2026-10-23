# Como editar o site

Entre com uma conta de administrador e abra **Painel → Conteúdo do site**
(`/admin/conteudo`).

## O que fica em cada lugar

| Tela | Conteúdo |
| --- | --- |
| Conteúdo do site | Logo, imagens institucionais, textos editoriais, chamadas, botões, links de menu, rodapé, páginas institucionais, política, ordem e visibilidade dos blocos |
| Configurações | Nome, WhatsApp, e-mail, endereço, horário, Instagram, CRECI, aviso de intermediação, título/texto principal Sobre, títulos alternativos do slider e módulo de pesquisa |
| Slides da home | Imagens, títulos, subtítulos, destinos, ativação e ordem dos slides |
| Fazendas | Cadastro de cada imóvel, descrições, atributos, fotos, vídeos, destaque e publicação |
| Parceiros | Nomes, logos, links, ativação e ordem dos parceiros |
| Contatos / Usuários | Atendimento das mensagens e controle de acesso |

O editor mostra atalhos para as telas relacionadas. Não é necessário editar
arquivos ou reenviar código para trocar esses conteúdos.

## Salvar, ocultar e organizar

1. Escolha uma página e edite os campos das seções.
2. Use os controles de visibilidade e de mover para cima/baixo.
3. Clique em **Salvar alterações**. Só então as mudanças passam ao site público.
4. **Descartar** retorna à última versão carregada.
5. Restaurar um campo ou a página inteira ao padrão também cria um rascunho:
   ainda é necessário salvar para publicá-lo.

Cabeçalho e rodapé são regiões separadas: reorganizar o menu muda a ordem de
seus links, e reorganizar o rodapé muda suas colunas. A linha de créditos
permanece ao final. A busca não pode ficar antes do slider enquanto ambos estão
visíveis. O cabeçalho se adapta quando o primeiro banner é ocultado ou movido.

No caso de edições simultâneas, uma revisão antiga não pode sobrescrever a nova.
O editor informa o conflito e mantém o rascunho para que você decida o que fazer.
Rascunhos não salvos também são guardados na sessão deste navegador quando o
armazenamento está disponível; ao retornar, é oferecida recuperação. Isso não
substitui salvar ou fazer backup. Outros visitantes recarregam o conteúdo ao
abrir uma página, voltar à aba ou pela atualização periódica.

## Imagens

Use **Escolher ou enviar imagem**, selecione JPEG/PNG até 12 MB, e salve as
alterações da página. É possível reutilizar imagens enviadas, trocar a imagem,
restaurar o padrão ou remover a imagem do campo.

Uma imagem enviada fica restrita ao administrador até ser usada em um campo
salvo. A biblioteca não permite excluir um arquivo ainda referenciado pelo
conteúdo salvo, mesmo em seção oculta. Primeiro substitua/remova a referência,
salve e só então exclua. Imagens que já foram públicas podem ter sido
armazenadas em cache ou copiadas; despublicar não apaga cópias de terceiros.

As imagens usam o mesmo disco persistente `UPLOADS_DIR` do portal, com nomes
aleatórios e remoção de metadados sensíveis. Essa escolha mantém a instalação
independente na Hostinger. Banco e uploads precisam de backup conjunto.

## Limites intencionais

O editor modifica conteúdo e a composição das seções existentes; não é um
editor livre de HTML, CSS ou JavaScript. O design aprovado permanece.
Campos obrigatórios, validações de segurança, mensagens de erro do sistema,
permissões, autenticação e dados privados de imóveis não podem ser alterados
como conteúdo editorial. O envio de código em um texto é exibido literalmente,
nunca executado. Os textos jurídicos devem ser revisados pelo responsável.

## Para manutenção

O registro compartilhado `shared/conteudo.ts` define campos, limites, padrões e
seções. Novos conteúdos editoriais devem ser registrados e ligados ao
componente público, e não acrescentados apenas ao painel. A publicação tem
validação no servidor e revisão otimista. O banco recebe apenas a tabela
aditiva `site_midias`; o documento editorial fica separado em `configuracoes`.
Nenhum cadastro de fazenda existente é substituído pela instalação.
