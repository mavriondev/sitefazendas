export {};
const arquivos = ["unitarios", "api", "videos", "documentos", "cards", "seguranca", "conteudo", "seo", "independencia", "filtros-publicos", "ficha", "rastreamento", "diagnostico-rastreamento", "conversoes", "revisao", "apresentacao", "agro"];
let falhas = 0;
for (const a of arquivos) {
  try {
    const m = await import(`./${a}.test.ts`);
    await m.rodar();
    console.log(`ok   ${a}`);
  } catch (e: any) {
    falhas++;
    console.error(`FALHA ${a}\n`, e?.stack ?? e);
  }
}
if (falhas) process.exit(1);
console.log("todos os testes passaram");
process.exit(0);
