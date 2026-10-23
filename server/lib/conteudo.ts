import type { Db } from "../db";
import { completarConteudo, PAGINAS_CONTEUDO, type ConteudoSite } from "../../shared/conteudo";
import { retornoSeguro } from "../../shared/navegacao";

export async function lerConteudo(db: Db): Promise<ConteudoSite> {
  const r = await db.query<{ valor: ConteudoSite }>("SELECT valor FROM configuracoes WHERE chave='conteudo_site'");
  return completarConteudo(r.rows[0]?.valor);
}

export function validarConteudo(entrada: unknown): string | null {
  const b = entrada as ConteudoSite;
  if (!b || typeof b !== "object" || !Number.isSafeInteger(b.revisao) || b.revisao < 0 ||
      !b.paginas || typeof b.paginas !== "object" || Array.isArray(b.paginas) ||
      Object.keys(b).some(k => !["revisao", "paginas"].includes(k))) return "Documento de conteúdo inválido.";
  if (Object.keys(b.paginas).length !== PAGINAS_CONTEUDO.length) return "As páginas do editor não correspondem à versão atual. Atualize a página.";
  for (const pagina of PAGINAS_CONTEUDO) {
    const atual = b.paginas[pagina.id];
    if (!atual || typeof atual !== "object" || Object.keys(atual).some(k => !["valores", "ordem", "ocultas"].includes(k)) ||
        !atual.valores || typeof atual.valores !== "object" || Array.isArray(atual.valores)) return `Conteúdo inválido: ${pagina.titulo}.`;
    const ids = pagina.secoes.map(s => s.id);
    if (!Array.isArray(atual.ordem) || atual.ordem.length !== ids.length ||
        new Set(atual.ordem).size !== ids.length || atual.ordem.some(id => !ids.includes(id)) ||
        !Array.isArray(atual.ocultas) || new Set(atual.ocultas).size !== atual.ocultas.length ||
        atual.ocultas.some(id => !ids.includes(id))) return `Ordem ou visibilidade inválida: ${pagina.titulo}.`;
    if (pagina.organizar === false && (atual.ocultas.length || atual.ordem.join(",") !== ids.join(","))) return "A estrutura dos formulários deve ser preservada.";
    const campos = pagina.secoes.flatMap(secao => secao.campos.map(campo => ({ ...campo, chave: `${secao.id}.${campo.chave}` })));
    if (Object.keys(atual.valores).length !== campos.length) return `Campos desconhecidos ou ausentes: ${pagina.titulo}.`;
    for (const campo of campos) {
      const v = atual.valores[campo.chave];
      if (typeof v !== "string" || v.length > campo.limite || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) return `Valor inválido: ${pagina.titulo} — ${campo.rotulo}.`;
      if (campo.tipo === "imagem" && v && !/^\/(?:images\/gramogol\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)|uploads\/[a-f0-9]{32}\.(?:jpg|png))$/.test(v)) return "Use uma imagem da biblioteca do site (JPEG ou PNG), sem endereço externo.";
      if (campo.tipo === "link" && v) {
        if (/[\\\u0000-\u0020\u007f]/.test(v)) return `Link inválido: ${campo.rotulo}.`;
        if (v.startsWith("/")) {
          if (retornoSeguro(v) !== v) return `Use um caminho interno válido: ${campo.rotulo}.`;
        } else {
          try {
            const url = new URL(v);
            if (url.protocol !== "https:" || url.username || url.password) return `Use um link https:// válido: ${campo.rotulo}.`;
          } catch { return `Link inválido: ${campo.rotulo}.`; }
        }
      }
    }
  }
  const home = b.paginas.home;
  if (!home.ocultas.includes("hero") && !home.ocultas.includes("busca") && home.ordem.indexOf("busca") < home.ordem.indexOf("hero")) return "A busca precisa ficar abaixo do slider.";
  return null;
}

export function imagensDoConteudo(doc: ConteudoSite): string[] {
  return [...new Set(PAGINAS_CONTEUDO.flatMap(p => p.secoes.flatMap(s => s.campos
    .filter(c => c.tipo === "imagem")
    .map(c => doc.paginas[p.id].valores[`${s.id}.${c.chave}`])
    .filter(v => v.startsWith("/uploads/"))
    .map(v => v.slice("/uploads/".length)))))];
}
