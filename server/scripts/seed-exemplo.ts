// Dados de EXEMPLO para desenvolvimento: 6 fazendas publicadas, 3 slides, 4 parceiros e textos de Sobre/Contato.
// Uso:    NODE_ENV=development npm run seed:exemplo            (cria ou recria os exemplos)
//         NODE_ENV=development npm run seed:exemplo -- --remover (apaga só os exemplos)
// Nunca roda em produção: exige NODE_ENV=development e recusa ambientes publicados.
// Só toca em registros marcados como exemplo; dados reais nunca são alterados.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { criarDbPg, type Db } from "../db";
import { migrar } from "../schema";
import { gravarConfig } from "../config";
import { apagarArquivo, salvarArquivo } from "../lib/arquivos";
import { sanitizarImagem } from "../lib/foto";
import { validarPublicacao, type AtributoRow, type FazendaRow, type FotoRow } from "../lib/publico";
import { gravarManual, validarEntradaManual, type EntradaManual } from "../lib/atributos-db";

const MARCA = "[EXEMPLO]";
const NOTA = `${MARCA} Criado por server/scripts/seed-exemplo.ts para desenvolvimento. Dados fictícios: não é imóvel real.`;
const PREFIXO_SLUG = "exemplo-";
const FONTE = "Dado de exemplo (fictício)";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const IMAGENS_SITE = path.resolve(AQUI, "../../client/public/images");

type Atributo = [chave: string, valor: number | string];
interface FazendaExemplo {
  chave: string; nome: string; regiao: string; culturas: string[]; area: number; faixa: boolean;
  preco: string; destaque: boolean; resumo: string; fotos: string[]; atributos: Atributo[];
}

const FAZENDAS: FazendaExemplo[] = [
  {
    chave: "cerrado-alto", nome: "Cerrado Alto", regiao: "Centro-Oeste (exemplo)", culturas: ["soja", "milho"], area: 1850, faixa: true,
    preco: "R$ 42.000.000 (valor de exemplo)", destaque: true, resumo: "Lavoura de grãos em chapada, com segunda safra de milho.",
    fotos: ["paisagem-lavoura.jpg", "farmland-aerial.jpg", "green-hills.jpg"],
    atributos: [["altitude_media", 980], ["argila_media", 45], ["declividade_media", 2], ["precipitacao_anual", 1650], ["agua", "Dois poços artesianos (exemplo)."], ["energia", "Rede trifásica até a sede (exemplo)."], ["benfeitorias", "Sede, galpão de máquinas e silo (exemplo)."]],
  },
  {
    chave: "vale-do-cafe", nome: "Vale do Café", regiao: "Sudeste (exemplo)", culturas: ["café"], area: 210, faixa: false,
    preco: "R$ 9.800.000 (valor de exemplo)", destaque: true, resumo: "Cafezal em encosta suave, com terreiro e tulha.",
    fotos: ["green-hills.jpg", "paisagem-colinas.jpg"],
    atributos: [["altitude_media", 1120], ["argila_media", 38], ["declividade_media", 10], ["agua", "Nascente e represa (exemplo)."], ["energia", "Rede monofásica (exemplo)."], ["uso_solo", "Café arábica e mata nativa (exemplo)."]],
  },
  {
    chave: "campos-do-sul", nome: "Campos do Sul", regiao: "Sul (exemplo)", culturas: ["arroz", "pecuária"], area: 760, faixa: true,
    preco: "R$ 17.500.000 (valor de exemplo)", destaque: true, resumo: "Várzea irrigada para arroz e campo nativo para gado.",
    fotos: ["paisagem-colinas.jpg"],
    atributos: [["altitude_media", 120], ["argila_media", 28], ["declividade_media", 1], ["agua", "Barragem para irrigação (exemplo)."], ["area_aproveitavel_ha", 610]],
  },
  {
    chave: "sertao-verde", nome: "Sertão Verde", regiao: "Nordeste (exemplo)", culturas: ["fruticultura"], area: 95, faixa: false,
    preco: "Sob consulta (exemplo)", destaque: false, resumo: "Pomar irrigado de manga e uva, próximo a polo exportador.",
    fotos: ["farmland-aerial.jpg", "paisagem-lavoura.jpg"],
    atributos: [["altitude_media", 360], ["argila_media", 18], ["declividade_media", 3], ["agua", "Outorga de canal de irrigação (exemplo)."], ["energia", "Rede trifásica (exemplo)."], ["logistica_rodovia", 4200]],
  },
  {
    chave: "pantanal-sereno", nome: "Pantanal Sereno", regiao: "Centro-Oeste (exemplo)", culturas: ["pecuária"], area: 6400, faixa: true,
    preco: "R$ 58.000.000 (valor de exemplo)", destaque: false, resumo: "Cria e recria em pastagem nativa e cultivada.",
    fotos: ["green-hills.jpg"],
    atributos: [["altitude_media", 140], ["declividade_media", 1], ["agua", "Corixos e bebedouros (exemplo)."], ["uso_solo", "Pastagem cultivada e campo nativo (exemplo)."]],
  },
  {
    chave: "serra-da-mata", nome: "Serra da Mata", regiao: "Sudeste (exemplo)", culturas: ["silvicultura", "pecuária"], area: 430, faixa: false,
    preco: "R$ 6.300.000 (valor de exemplo)", destaque: false, resumo: "Eucalipto em rotação e área de pasto em relevo ondulado.",
    fotos: ["paisagem-colinas.jpg", "green-hills.jpg"],
    atributos: [["altitude_media", 870], ["argila_media", 33], ["declividade_media", 14], ["energia", "Rede monofásica (exemplo)."], ["benfeitorias", "Casa de caseiro e curral (exemplo)."]],
  },
];

const SLIDES = [
  { titulo: `${MARCA} Grãos no Centro-Oeste`, subtitulo: "Slide de exemplo: fazenda fictícia com lavoura de soja e milho.", imagem: "paisagem-lavoura.jpg", fazenda: "cerrado-alto" },
  { titulo: `${MARCA} Café de altitude`, subtitulo: "Slide de exemplo: propriedade fictícia para testar o carrossel.", imagem: "paisagem-colinas.jpg", fazenda: "vale-do-cafe" },
  { titulo: `${MARCA} Venda sua fazenda com sigilo`, subtitulo: "Slide de exemplo sem link para fazenda. Substitua no painel.", imagem: "green-hills.jpg", fazenda: null },
];

const PARCEIROS = [
  { nome: `${MARCA} Coop Verde`, logo: "logo-cooperativa.png", url: "https://example.com/" },
  { nome: `${MARCA} Geo Campo`, logo: "logo-topografia.png", url: null },
  { nome: `${MARCA} Agro Crédito`, logo: "logo-credito.png", url: "https://example.org/" },
  { nome: `${MARCA} Trator Sul`, logo: "logo-maquinas.png", url: null },
];

const TEXTOS: Record<string, string> = {
  sobre_titulo: `Sobre nós ${MARCA}`,
  sobre_texto: [
    `${MARCA} Este é um texto de exemplo para a página Sobre. Troque-o em Painel → Configurações antes de divulgar o site.`,
    "Somos uma equipe fictícia de corretores especializada em fazendas e propriedades rurais. Apresentamos cada imóvel com dados claros e a indicação de onde cada informação vem.",
    "Por proteção dos proprietários, a localização exata, o código do CAR e os limites das propriedades só são informados em atendimento direto.",
  ].join("\n\n"),
  contato_email: "contato@example.com",
  contato_endereco: `${MARCA} Endereço fictício — substitua no painel`,
  contato_horario: `${MARCA} Segunda a sexta, das 8h às 18h`,
};

function exigirDesenvolvimento(): string {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Seed de exemplo só roda com NODE_ENV=development. Ex.: NODE_ENV=development npm run seed:exemplo");
  }
  if (process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Seed de exemplo bloqueado em ambiente publicado.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL (banco de desenvolvimento).");
  return url;
}

const dbDoCliente = (c: pg.PoolClient): Db => ({
  async query(text, params) { const r = await c.query(text, params as any[]); return { rows: r.rows, rowCount: r.rowCount ?? 0 }; },
});
const nomeAleatorio = (tipo: "jpg" | "png") => `${crypto.randomBytes(16).toString("hex")}.${tipo}`;

async function lerImagem(nome: string): Promise<{ dados: Buffer; tipo: "jpg" | "png" }> {
  const local = path.join(AQUI, "exemplo", nome);
  const caminho = await fs.access(local).then(() => local, () => path.join(IMAGENS_SITE, nome));
  const img = sanitizarImagem(await fs.readFile(caminho));
  if (!img) throw new Error(`Imagem de exemplo inválida: ${nome}`);
  return { dados: img.dados, tipo: img.tipo === "png" ? "png" : "jpg" };
}

/** Apaga os registros de exemplo e devolve os arquivos a remover do disco (após o COMMIT). */
async function removerExemplos(db: Db): Promise<{ arquivos: string[]; contagem: Record<string, number> }> {
  const arquivos: string[] = [];
  const fotos = await db.query<{ arquivo: string }>(
    `SELECT ff.arquivo FROM fazenda_fotos ff JOIN fazendas f ON f.id = ff.fazenda_id
      WHERE f.slug LIKE $1 AND f.notas_internas LIKE $2`, [`${PREFIXO_SLUG}%`, `${MARCA}%`]);
  arquivos.push(...fotos.rows.map((r) => r.arquivo));
  const slides = await db.query<{ arquivo: string | null }>("DELETE FROM slides WHERE titulo LIKE $1 RETURNING arquivo", [`${MARCA}%`]);
  const parceiros = await db.query<{ arquivo: string | null }>("DELETE FROM parceiros WHERE nome LIKE $1 RETURNING arquivo", [`${MARCA}%`]);
  for (const r of [...slides.rows, ...parceiros.rows]) if (r.arquivo) arquivos.push(r.arquivo);
  const fazendas = await db.query("DELETE FROM fazendas WHERE slug LIKE $1 AND notas_internas LIKE $2", [`${PREFIXO_SLUG}%`, `${MARCA}%`]);
  const textos = await db.query("DELETE FROM configuracoes WHERE chave = ANY($1) AND valor::text LIKE $2", [Object.keys(TEXTOS), `%${MARCA}%`]);
  const email = await db.query("DELETE FROM configuracoes WHERE chave = 'contato_email' AND valor = $1::jsonb", [JSON.stringify(TEXTOS.contato_email)]);
  return { arquivos, contagem: { fazendas: fazendas.rowCount, slides: slides.rowCount, parceiros: parceiros.rowCount, textos: textos.rowCount + email.rowCount } };
}

async function criarExemplos(db: Db, uploadsDir: string, escritos: string[]) {
  const gravar = async (nome: string) => {
    const img = await lerImagem(nome);
    const arquivo = nomeAleatorio(img.tipo);
    escritos.push(arquivo);
    await salvarArquivo(uploadsDir, arquivo, img.dados);
    return arquivo;
  };

  // Um slug real (sem marca) com o mesmo nome bloqueia o seed em vez de ser sobrescrito.
  const conflito = await db.query<{ slug: string }>("SELECT slug FROM fazendas WHERE slug = ANY($1)", [FAZENDAS.map((f) => PREFIXO_SLUG + f.chave)]);
  if (conflito.rowCount) throw new Error(`Já existe fazenda não marcada como exemplo com o slug ${conflito.rows[0].slug}. Nada foi alterado.`);

  const ids = new Map<string, number>();
  for (const [i, f] of FAZENDAS.entries()) {
    const descricao = [
      `${MARCA} Anúncio fictício para desenvolvimento: não representa um imóvel à venda.`,
      `${f.resumo} Área, preço e características são inventados; as fotos são paisagens ilustrativas.`,
    ].join("\n");
    const r = await db.query<{ id: number }>(
      `INSERT INTO fazendas (slug, titulo, descricao_publica, regiao_publica, culturas, area_ha, area_exibicao, preco_exibicao, destaque, destaque_ordem, notas_internas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [PREFIXO_SLUG + f.chave, `${MARCA} Fazenda ${f.nome}`, descricao, f.regiao, f.culturas, f.area, f.faixa ? "faixa" : "exata", f.preco, f.destaque, i, NOTA],
    );
    const id = r.rows[0].id;
    ids.set(f.chave, id);
    for (const [ordem, foto] of f.fotos.entries()) {
      await db.query("INSERT INTO fazenda_fotos (fazenda_id, arquivo, legenda, ordem, capa) VALUES ($1,$2,$3,$4,$5)",
        [id, await gravar(foto), "Foto ilustrativa de exemplo — não é a propriedade.", ordem, ordem === 0]);
    }
    for (const [chave, valor] of f.atributos) {
      const entrada: EntradaManual = { achado: "detectado", valor, fonte: FONTE, observacao: "Valor de exemplo; não verificado.", publico: true };
      const erro = validarEntradaManual(chave, entrada);
      if (erro) throw new Error(`${f.nome}: ${erro}`);
      await gravarManual(db, id, chave, entrada);
    }
    // Consultas em sequência: a transação usa uma única conexão.
    const linha = await db.query<FazendaRow>("SELECT * FROM fazendas WHERE id=$1", [id]);
    const fotos = await db.query<FotoRow>("SELECT * FROM fazenda_fotos WHERE fazenda_id=$1 ORDER BY ordem", [id]);
    const atributos = await db.query<AtributoRow>("SELECT * FROM fazenda_atributos WHERE fazenda_id=$1", [id]);
    const problemas = validarPublicacao(linha.rows[0], fotos.rows, atributos.rows);
    if (problemas.length) throw new Error(`${f.nome} não passou na validação de publicação: ${problemas.join(" ")}`);
    await db.query("UPDATE fazendas SET status='publicada', publicado_em = now() - ($2::int * interval '1 day') WHERE id=$1", [id, i]);
  }

  for (const [ordem, s] of SLIDES.entries()) {
    await db.query("INSERT INTO slides (titulo, subtitulo, arquivo, link_tipo, fazenda_id, ordem, ativo) VALUES ($1,$2,$3,$4,$5,$6,TRUE)",
      [s.titulo, s.subtitulo, await gravar(s.imagem), s.fazenda ? "fazenda" : "nenhum", s.fazenda ? ids.get(s.fazenda) : null, ordem]);
  }
  for (const [ordem, p] of PARCEIROS.entries()) {
    await db.query("INSERT INTO parceiros (nome, arquivo, url, ordem, ativo) VALUES ($1,$2,$3,$4,TRUE)", [p.nome, await gravar(p.logo), p.url, ordem]);
  }

  // Textos: só preenche o que ainda está no padrão (nunca sobrescreve texto real digitado no painel).
  const atuais = await db.query<{ chave: string }>("SELECT chave FROM configuracoes WHERE chave = ANY($1)", [Object.keys(TEXTOS)]);
  const ocupadas = new Set(atuais.rows.map((r) => r.chave));
  const textos = Object.fromEntries(Object.entries(TEXTOS).filter(([k]) => !ocupadas.has(k)));
  const erro = await gravarConfig(db, textos);
  if (erro) throw new Error(`Textos de exemplo: ${erro}`);
  return { fazendas: FAZENDAS.length, slides: SLIDES.length, parceiros: PARCEIROS.length, textos: Object.keys(textos), textosMantidos: [...ocupadas] };
}

async function main() {
  const url = exigirDesenvolvimento();
  const remover = process.argv.includes("--remover");
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR || "uploads");
  const banco = criarDbPg(url);
  await migrar(banco);
  const cliente = await banco.pool.connect();
  const db = dbDoCliente(cliente);
  const escritos: string[] = [];
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('sitefazendas-seed-exemplo'))");
    const removidos = await removerExemplos(db);
    const criados = remover ? null : await criarExemplos(db, uploadsDir, escritos);
    await cliente.query("COMMIT");
    for (const a of removidos.arquivos) await apagarArquivo(uploadsDir, a);
    console.log(remover ? "[seed] Exemplos removidos:" : "[seed] Exemplos recriados:", JSON.stringify(remover ? removidos.contagem : criados));
    if (criados && criados.textosMantidos.length) console.log(`[seed] Textos já personalizados foram mantidos: ${criados.textosMantidos.join(", ")}`);
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    for (const a of escritos) await apagarArquivo(uploadsDir, a);
    throw e;
  } finally {
    cliente.release();
    await banco.pool.end();
  }
}

main().catch((e) => { console.error("[seed] Falhou:", e.message); process.exit(1); });
