import type { Express } from "express";
import multer from "multer";
import crypto from "node:crypto";
import type { Db } from "../db";
import { lerSeo, validarSeo, imagensSeo, resolverSeo } from "../lib/seo";
import { sanitizarImagem } from "../lib/foto";
import { salvarArquivo, apagarArquivo } from "../lib/arquivos";
import { rastreamentoPadrao, validarRastreamento } from "../../shared/rastreamento";

export function registrarRotasSeo(app: Express, db: Db, uploadsDir:string, siteUrl?:string) {
  app.get("/api/public/rastreamento", async (_req, res) => {
    const c = (await lerSeo(db)).rastreamento;
    res.set("Cache-Control", "no-store").json(validarRastreamento(c) ? rastreamentoPadrao() : c);
  });
  app.get("/api/public/seo",async(req,res)=>{
    const c=req.query.caminho;
    if(typeof c!=="string"||c.length>250||!c.startsWith("/")||/[\\?#\u0000-\u0020]/.test(c)) return res.status(400).json({message:"Caminho inválido."});
    res.json(await resolverSeo(db,c,siteUrl));
  });
  app.get("/api/admin/seo",async(_req,res)=>res.json(await lerSeo(db)));
  app.get("/api/admin/seo/fazendas",async(_req,res)=>{
    const r=await db.query("SELECT slug,titulo,status FROM fazendas ORDER BY titulo");
    res.json({fazendas:r.rows});
  });
  app.put("/api/admin/seo",async(req,res)=>{
    const erro=validarSeo(req.body);
    if(erro) return res.status(400).json({message:erro});
    const b={...req.body,paginas:{...req.body.paginas}};
    const slugs=Object.keys(b.paginas).filter(c=>c.startsWith("/fazenda/")).map(c=>c.slice(9));
    if(slugs.length) {
      const f=await db.query("SELECT slug FROM fazendas WHERE slug=ANY($1::text[])",[slugs]);
      const atuais=new Set(f.rows.map(x=>x.slug));
      for(const slug of slugs) if(!atuais.has(slug)) delete b.paginas[`/fazenda/${slug}`];
    }
    const imagens=imagensSeo(b);
    const existentes=await db.query("SELECT arquivo FROM seo_midias WHERE arquivo=ANY($1::text[])",[imagens]);
    if(existentes.rows.length!==imagens.length) return res.status(400).json({message:"Uma imagem não está na biblioteca de SEO. Selecione ou envie novamente."});
    const salvo=await db.query(`
      WITH referencias AS MATERIALIZED (SELECT arquivo FROM seo_midias WHERE arquivo=ANY($3::text[]) ORDER BY arquivo FOR UPDATE),
      salvo AS (
        INSERT INTO configuracoes(chave,valor) SELECT 'seo_site',$2::jsonb
        WHERE (SELECT count(*) FROM referencias)=cardinality($3::text[]) AND ($1::bigint=0 OR EXISTS(SELECT 1 FROM configuracoes WHERE chave='seo_site' AND (valor->>'revisao')::bigint=$1))
        ON CONFLICT(chave) DO UPDATE SET valor=EXCLUDED.valor,atualizado_em=now() WHERE (configuracoes.valor->>'revisao')::bigint=$1 RETURNING valor
      ), midias AS (UPDATE seo_midias SET publicado=(arquivo=ANY($3::text[])) WHERE EXISTS(SELECT 1 FROM salvo) RETURNING arquivo)
      SELECT valor FROM salvo`,[b.revisao,JSON.stringify({...b,revisao:b.revisao+1}),imagens]);
    if(!salvo.rowCount) return res.status(409).json({message:"O SEO foi alterado em outra sessão. Recarregue antes de salvar; seu rascunho não foi publicado."});
    res.json(salvo.rows[0].valor);
  });
  app.get("/api/admin/seo/midias",async(_req,res)=>{
    const r=await db.query("SELECT arquivo,publicado FROM seo_midias ORDER BY criado_em DESC LIMIT 200");
    res.json({midias:r.rows.map(m=>({...m,url:`/uploads/${m.arquivo}`}))});
  });
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024,files:1,fields:0,parts:1}});
  app.post("/api/admin/seo/midias",upload.single("arquivo"),async(req,res)=>{
    if(!req.file) return res.status(400).json({message:"Selecione uma imagem JPEG ou PNG."});
    const imagem=sanitizarImagem(req.file.buffer);
    if(!imagem) return res.status(400).json({message:"Imagem inválida. Use JPEG ou PNG."});
    const arquivo=`${crypto.randomBytes(16).toString("hex")}.${imagem.tipo==="jpeg"?"jpg":"png"}`;
    await salvarArquivo(uploadsDir,arquivo,imagem.dados);
    try {await db.query("INSERT INTO seo_midias(arquivo) VALUES($1)",[arquivo]);}
    catch(e){await apagarArquivo(uploadsDir,arquivo);throw e;}
    res.status(201).json({arquivo,url:`/uploads/${arquivo}`,publicado:false});
  });
  app.delete("/api/admin/seo/midias/:arquivo",async(req,res)=>{
    const arquivo=String(req.params.arquivo);
    if(!/^[a-f0-9]{32}\.(jpg|png)$/.test(arquivo)) return res.status(400).json({message:"Arquivo inválido."});
    const r=await db.query("DELETE FROM seo_midias WHERE arquivo=$1 AND NOT publicado RETURNING arquivo",[arquivo]);
    if(!r.rowCount) {
      const existe=await db.query("SELECT 1 FROM seo_midias WHERE arquivo=$1",[arquivo]);
      return res.status(existe.rowCount?409:404).json({message:existe.rowCount?"Imagem em uso. Remova as referências e salve antes de excluir.":"Imagem não encontrada."});
    }
    await apagarArquivo(uploadsDir,arquivo); res.json({ok:true});
  });
}
