# Dados do governo sobre o ativo (aba pública e seção do painel)

## Como funciona
- Cada dado da fazenda tem **origem**: `oficial` (leitura automática de base pública) ou `corretor` (digitado/confirmado por uma pessoa).
- No site, a página da fazenda mostra duas abas: **Informações do imóvel** (corretor) e **Informações governamentais** (oficial, com fonte e data de cada item e data da última atualização). Sem dados de um dos lados, só aparece o outro, sem abas.
- No painel (aba "Dados da terra") há duas seções: **Dados do governo sobre o ativo** (botão "Atualizar dados do governo") e **Informado por você**.
- Nada é publicado sozinho: cada item tem a sua chave "Mostrar no site". Leitura automática nunca vira "confirmado".

## O que o botão "Atualizar dados do governo" consulta hoje
| Dado | Fonte | Onde roda |
|---|---|---|
| Altitude, argila | SICAR espelhado (Hub) | Hub, mesma chave do site |
| Terra indígena (sobreposição) | FUNAI, `POST /api/funai/sobreposicao-poligono` | Hub |
| Unidade de conservação (sobreposição) | ICMBio/CNUC, `POST /api/icmbio/sobreposicao` | Hub |
| Rodovia e ferrovia mais próximas | IBGE BC250 2025 (WFS), com controle positivo | Direto do site (portado do Connect) |

## Regras de confiança (iguais às do Connect)
- Falha de consulta = "sem dado". Nunca vira "não detectado". Falha não apaga uma leitura anterior boa.
- "Não detectado" por fonte automática nunca aparece no público. "Sem sobreposição" só aparece se o corretor confirmar (documento/vendedor/visita).
- Sobreposição encontrada nunca aparece no site (só no painel). Dados de proprietário nunca são buscados nem exibidos.
- Detalhes de sobreposição (nome da TI/UC, %) ficam só no painel.

## Ainda não incluído (precisa da Hub)
Bioma, uso do solo (MapBiomas), alertas de desmatamento, NDVI, APP, energia e água/hidrografia.
Motivo: dependem de credenciais ou de camadas que não consegui validar daqui. As camadas BC100 de energia/água usadas no Connect só cobrem o Centro-Oeste; usá-las aqui repetiria o erro de "sem energia" por falta de cobertura.
O catálogo (`shared/atributos.ts`) já tem as chaves `uso_solo`, `ndvi`, `alertas_desmatamento`, `app_estimada`; quando a Hub oferecer um endpoint, basta gravar com `gravarAutomatico` e elas aparecem na aba oficial.

### Contrato sugerido para a Hub (pedido ao Replit)
`POST /api/verificacoes/poligono` com `{ geometry }` e a mesma `x-api-key`, devolvendo para cada chave
`{ chave, achado: "detectado"|"nao_detectado"|"indeterminado", valor?, unidade?, fonte, consultado_em, observacao? }`
para: `bioma`, `uso_solo` (MapBiomas, com ano), `alertas_desmatamento`, `app_estimada`, `energia_rede` (distância, com controle positivo e checagem de cobertura da camada) e `agua_hidrografia`.
Regras: falha ou camada sem cobertura = `indeterminado`; nunca devolver `nao_detectado` sem controle positivo.
