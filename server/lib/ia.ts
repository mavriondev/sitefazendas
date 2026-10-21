// Rascunho de texto de venda por IA (Anthropic). SEMPRE sugestão: o admin revisa e publica.
// A IA só recebe dados PÚBLICOS (faixas e região pública) — nunca município, CAR, coordenadas ou polígono.

import { vazaDadoSensivel, type DadosPrivados } from "./sigilo";

export interface EntradaTexto {
  titulo: string; regiao_publica: string | null; area: string | null; culturas: string[];
  atributos: Array<{ rotulo: string; texto: string; confianca: "confirmado" | "indicado" }>;
  observacoes_do_corretor?: string;
}

export const PROMPT_SISTEMA = `Você escreve a descrição comercial de uma fazenda à venda no Brasil, em português, tom sóbrio e profissional.
Regras obrigatórias:
- Use SOMENTE os fatos fornecidos. Não invente benfeitorias, produtividade, sacas por hectare, preço, rentabilidade nem estrutura.
- Fatos "indicados por fonte" devem ser escritos com cautela ("segundo levantamento em fonte pública", "indicativo de..."). Fatos "confirmados" podem ser afirmados.
- Não cite município, cidade, rodovia pelo nome, coordenadas, código CAR nem nome de proprietário. Use apenas a região fornecida.
- Não prometa nada que não esteja nos fatos. Não use superlativos vazios.
- Entre 80 e 160 palavras, em 1 ou 2 parágrafos, sem títulos e sem listas.`;

export function montarPergunta(e: EntradaTexto): string {
  const linhas = [
    `Título: ${e.titulo}`,
    e.regiao_publica ? `Região: ${e.regiao_publica}` : null,
    e.area ? `Área: ${e.area}` : null,
    e.culturas.length ? `Culturas/aptidões informadas: ${e.culturas.join(", ")}` : null,
    ...e.atributos.map((a) => `- ${a.rotulo}: ${a.texto} [${a.confianca === "confirmado" ? "confirmado" : "indicado por fonte"}]`),
    e.observacoes_do_corretor ? `Observações do corretor: ${e.observacoes_do_corretor}` : null,
  ].filter(Boolean);
  return `Fatos da fazenda:\n${linhas.join("\n")}\n\nEscreva a descrição.`;
}

export type ResultadoTexto = { ok: true; texto: string; avisos: string[] } | { ok: false; motivo: string };

export async function gerarTexto(
  e: EntradaTexto,
  privado: DadosPrivados,
  opts: { apiKey?: string; modelo?: string; fetchFn?: typeof fetch } = {},
): Promise<ResultadoTexto> {
  const key = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
  if (!key) return { ok: false, motivo: "IA não configurada (falta ANTHROPIC_API_KEY)." };
  const f = opts.fetchFn ?? fetch;
  try {
    const r = await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: opts.modelo ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
        max_tokens: 700,
        system: PROMPT_SISTEMA,
        messages: [{ role: "user", content: montarPergunta(e) }],
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!r.ok) return { ok: false, motivo: `IA respondeu ${r.status}.` };
    const j: any = await r.json();
    const texto = String(j?.content?.find((c: any) => c?.type === "text")?.text ?? "").trim();
    if (!texto) return { ok: false, motivo: "IA não devolveu texto." };
    // Rede de segurança: se vazou algo sensível, devolve como erro (nunca como sugestão).
    const vazou = vazaDadoSensivel(texto, privado);
    if (vazou.length) return { ok: false, motivo: `O texto gerado ${vazou.join("; ")}. Tente de novo ou escreva manualmente.` };
    return { ok: true, texto, avisos: [] };
  } catch (err: any) {
    return { ok: false, motivo: `IA indisponível (${err?.name === "TimeoutError" ? "tempo esgotado" : "falha de rede"}).` };
  }
}
