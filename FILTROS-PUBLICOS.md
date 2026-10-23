# Busca pública e autorização editorial

Estado e região do Brasil não usam o CAR, município, geometria ou UF do cadastro privado.
Em **Dados da terra → Informado por você**, salve **Estado público** e ative
**Mostrar no site**. A macrorregião deriva exclusivamente desse estado autorizado.

Para área, salve **Área total pública** e ative **Mostrar no site**. O editor sugere
a área interna somente para facilitar a digitação; ela não é salva nem publicada
automaticamente. O cadastro interno continua separado. Anúncios antigos sem esse
opt-in ficam sem área pública até a revisão pelo corretor, inclusive se antes
estavam configurados como “área exata”.

Altitude, argila, água e energia precisam estar públicos, com dado disponível e
achado positivo. Um atributo privado, sem dado ou pertencente a rascunho/arquivo
não alimenta resultados ou opções. “Com água/energia” significa presença informada,
não auditoria da capacidade ou disponibilidade. Não detectado não conta como presença.

Faixas públicas: área pelas classes existentes; altitude em 100 m; argila em 5 pontos
percentuais. Seleção, opções e ordenação comparam a mesma classe pública, nunca o
número exato. URLs antigas de mínimo/máximo são removidas na interface e comparadas
por classes no servidor. CAR, município e coordenadas não são parâmetros de busca.

Não há alterações de esquema: os novos controles usam atributos do site. Não há
consulta à Hub nos filtros. A Hub e o Mavrion Connect permanecem somente leitura.
As respostas do catálogo também não distribuem silhueta ou coordenadas de mapa
aproximado, mesmo se um mapa opcional estiver habilitado no cadastro do detalhe.

Testes: `NODE_ENV=test npx tsx server/__tests__/run-all.ts`; a suíte
`filtros-publicos` cobre opt-in, retirada da publicação, faixas, tentativas de
afunilamento, ordenação, estados/regiões, dados inválidos e campos privados.
