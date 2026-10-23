// "Atualizar dados oficiais": lê bases públicas para o polígono da fazenda e grava com origem "oficial".
//  - Hub Mavrion (mesma chave do site): altitude, argila (em routes/admin.ts), terra indígena e unidade de conservação.
//  - IBGE (WFS, direto): rodovia e ferrovia mais próximas, com controle positivo (ver ibge-malha.ts).
// Regras: falha NUNCA vira "não detectado"; leitura automática nunca vira "confirmado"; nada é publicado sozinho.

import type { Db } from "../db";
import type { Hub, HubResultado, SobreposicaoHub } from "./hub";
import { gravarAutomatico } from "./atributos-db";
import { aneisExternos } from "./geo-medicao";
import { verificarMalha, type FontesMalha } from "./ibge-malha";

export type Resultado = Record<string, "gravado" | "mantido">;

function caixaDoPoligono(geojson: any) {
  const pts = aneisExternos(geojson).flat();
  if (!pts.length) return null;
  const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  return { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
}

async function gravarSobreposicao(db: Db, id: number, chave: string, fonte: string, r: HubResultado<SobreposicaoHub>): Promise<"gravado" | "mantido"> {
  if (!r.ok) return gravarAutomatico(db, id, chave, { achado: "indeterminado", fonte, observacao: `Consulta não concluída: ${r.motivo}` });
  if (!r.data.sobrepoe) {
    return gravarAutomatico(db, id, chave, {
      achado: "nao_detectado", fonte,
      observacao: "Nenhuma sobreposição na base consultada. Isso não prova que não exista (bases têm defasagem); só vale como informação ao público se o corretor confirmar por documento.",
    });
  }
  const descricao = r.data.itens.map((i) => (i.detalhe ? `${i.nome} (${i.detalhe})` : i.nome)).join("; ");
  return gravarAutomatico(db, id, chave, { achado: "detectado", valor: descricao, fonte });
}

export async function atualizarDadosOficiais(
  db: Db, hub: Hub, fazendaId: number, geojson: any, opts: { fontesMalha?: FontesMalha } = {},
): Promise<Resultado> {
  const out: Resultado = {};
  const geometry = geojson?.geometry || geojson;
  const caixa = caixaDoPoligono(geojson);
  if (!caixa) return out;

  out.sobrep_terra_indigena = await gravarSobreposicao(db, fazendaId, "sobrep_terra_indigena", "FUNAI, base espelhada na Hub Mavrion", await hub.sobreposicaoTerraIndigena(geometry));
  out.sobrep_unidade_conservacao = await gravarSobreposicao(db, fazendaId, "sobrep_unidade_conservacao", "ICMBio/CNUC, base espelhada na Hub Mavrion", await hub.sobreposicaoUnidadeConservacao(geometry));

  for (const malha of ["rodovia", "ferrovia"] as const) {
    const v = await verificarMalha({ geojson, bbox: caixa }, malha, opts.fontesMalha);
    out[v.chave] = await gravarAutomatico(db, fazendaId, v.chave, { achado: v.achado, valor: v.valor, fonte: v.fonte, observacao: v.observacao });
  }
  return out;
}
