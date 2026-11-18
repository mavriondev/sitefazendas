# Home compacta e parceiros

## Edição e comportamento

- O título e o texto da faixa são editados em **Configurações**. Valores personalizados já salvos são preservados; os novos padrões valem apenas quando não há configuração salva.
- **Conteúdo do site → Página inicial → Faixa inicial** mantém os controles de posição e visibilidade. Campos visuais antigos continuam no documento editorial, mas não são apresentados como controles da nova faixa.
- Slides continuam cadastrados no painel e na API por compatibilidade; a home não os renderiza nem executa temporizador.
- A home, a navegação de computador/celular e o rodapé compartilham uma consulta de parceiros. Enquanto ela está carregando ou falha, não há promoção pública de parceiros.
- Um parceiro ativo habilita a seção e os links. Ocultar a seção da home ou a lista da página de parceiros impede a promoção; ocultar somente o item de menu mantém a decisão editorial para esse item.
- Os dados são renovados ao recarregar o contexto, focar a janela e a cada minuto com a página visível. Cadastro e rota administrativa permanecem disponíveis.

## Limpeza seletiva, nunca automática

A origem comprovada dos quatro parceiros demonstrativos é `server/scripts/seed-exemplo.ts`: Coop Verde, Geo Campo, Agro Crédito e Trator Sul. A preparação editorial antiga pode ter retirado o prefixo `[EXEMPLO]`.

O procedimento exige correspondência de **nome conhecido, URL, ordem e hash dos bytes do logo original sanitizado**. Nome desconhecido, logo ausente, arquivo indisponível ou conteúdo alterado não autorizam exclusão. Casos inconclusivos precisam de conferência humana.

Na raiz do produto, em um ambiente de manutenção autorizado com configuração privada:

```sh
# Somente leitura: usa DATABASE_URL e UPLOADS_DIR já configurados,
# ou um caminho explícito para um runtime privado com essas duas chaves.
npx tsx server/scripts/limpar-parceiros-demo.ts --runtime=/caminho/privado/runtime.json

# Apenas após conferir os IDs e autorizar a remoção no ambiente correto:
npx tsx server/scripts/limpar-parceiros-demo.ts --runtime=/caminho/privado/runtime.json \
  --apply --expected-plan=HASH_RETORNADO_PELO_DRY_RUN
```

O comando não lê um destino padrão, não imprime credenciais, não executa seed e não faz deploy. A aplicação usa transação, confere alterações concorrentes e confirma os IDs preservados. A repetição não encontra novamente registros já removidos. Uploads são mantidos intencionalmente, evitando apagar um logo compartilhado por outro registro. Fazendas, slides e textos não são modificados.

## Conferência desta entrega

- `npm run check`, `npm test` e `npm run build` executados na cópia versionada e na cópia de prévia.
- A entrega standalone é baseada na `main` `6d0ca0b9dd14cf90b8f3003153212e99488eaf42`, com conferência de blobs antes de aplicar somente os arquivos desta alteração. Tipos, testes e build também executados nessa árvore.
- Testes isolados cobrem lista vazia, ativação/desativação, visibilidade editorial, destinos de links, edição da chamada, preservação dos slides e limpeza seletiva/repetível com registros editados preservados.
- A prévia usa banco sintético descartável, sem conexão ao banco comercial. Seu cadastro temporário foi marcado como destaque somente na fixture de teste, para verificar o início dos cartões.
- **Nenhuma remoção foi feita no banco comercial/de destino.** O ambiente acessível de prévia não possuía parceiros. A remoção dos demonstrativos foi comprovada somente em testes isolados. Inventário e eventual limpeza do destino continuam pendentes de acesso e autorização específicos.
- Nenhuma publicação, merge remoto, alteração do CRM ou seed foi executado.
