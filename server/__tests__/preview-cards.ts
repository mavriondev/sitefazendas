// Prévia descartável: nunca abre o banco real e não faz parte do servidor de produção.
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { criarDbTeste } from "./helpers";
import { criarApp } from "../app";
import { garantirAdmin } from "../auth";

async function main() {
  if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL) throw Error("Somente dados sintéticos isolados");
  const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), "cards-preview-"));
  const nome = "00000000000000000000000000000040.jpg";
  await fs.copyFile(path.resolve("client/public/images/gramogol/grao-mogol-serra.jpg"), path.join(uploadsDir, nome));
  const db = await criarDbTeste();
  await garantirAdmin(db, "admin@teste.com", "senha-forte-1");
  const f = (await db.query(`INSERT INTO fazendas(slug,titulo,status,regiao_publica,area_ha,descricao_publica,culturas)
    VALUES('fazenda-cards-teste','Fazenda temporária de cards','publicada','Região ampla de teste',1454,
    'Cadastro sintético isolado para conferir cards. Nenhum dado comercial real.','{Teste}') RETURNING id`)).rows[0].id;
  await db.query("INSERT INTO fazenda_fotos(fazenda_id,arquivo,legenda,capa) VALUES($1,$2,'Imagem ilustrativa do portal, não retrata este cadastro',TRUE)", [f,nome]);
  for (const [chave,valor,origem] of [["agua","Informação sintética sobre água","corretor"],["area_total_ha",1454,"corretor"],["altitude_media",812,"oficial"]]) {
    await db.query(`INSERT INTO fazenda_atributos(fazenda_id,chave,estado,achado,valor_json,publico,origem)
      VALUES($1,$2,'indicado','detectado',$3::jsonb,TRUE,$4)`,[f,chave,JSON.stringify(valor),origem]);
  }
  const app = criarApp({ db, uploadsDir, segredo:"segredo-apenas-para-cards-sinteticos", producao:false, limitar:false,
    clientDir:path.resolve("dist/public"),siteUrl:"https://"+process.env.PREVIEW_HOST });
  const server = app.listen(Number(process.env.PORT),"0.0.0.0",()=>console.log("Prévia de cards pronta em banco sintético independente."));
  process.on("SIGTERM",()=>server.close(()=>{void fs.rm(uploadsDir,{recursive:true,force:true}).finally(()=>process.exit(0));}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
