import express, { type Express, type Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncRoute as route, who, canFarm, publicUser, check, id, event } from "./security";
import { catalog, closeSelection, externalName, materialKeys, openSelection, type MaterialContext, type ResolvedMaterial } from "./materials-catalog";
import { createLink, shareDto, validateLink } from "./materials-links";
import { sendMaterial, sendZip } from "./materials-zip";
import { limitsOf, separateDirectory } from "./materials-storage";
import { uploadRoutes } from "./materials-upload";

export function registerMaterials(o: MaterialContext, secret: string, limit = true) {
  separateDirectory(o.dir,[o.siteDocumentsDir,o.siteUploadsDir]);
  let streams = 0;
  async function deliver(res: Response, fid: number, keys: string[], zipped: boolean, validate: () => Promise<void>, externalKeys?: string[]) {
    check(streams < 2,429,"Há downloads em andamento. Aguarde e tente novamente.");
    streams++;
    const timeout=setTimeout(()=>res.destroy(),15*60000);timeout.unref();
    let files: ResolvedMaterial[] = [];
    try {
      await validate(); files = await openSelection(o,fid,keys);
      // Não revelar nomes de arquivos originais, legendas, fazenda ou outros metadados para destinatários externos.
      files.forEach((f,i) => { f.name = externalKeys ? externalName(f,externalKeys.indexOf(f.key)) : `${String(i+1).padStart(2,"0")} - ${f.name}`; });
      res.setHeader("Content-Security-Policy","default-src 'none'; sandbox");
      if (zipped) await sendZip(res,files,limitsOf(o).zip_bytes,validate);
      else await sendMaterial(res,files[0],validate);
    } catch(e) { if(res.headersSent) res.destroy(); else throw e; }
    finally { clearTimeout(timeout);streams--; await closeSelection(files); }
  }
  return {
    publicRoutes(app: Express) {
      const publicLimit = rateLimit({ windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false,message:{message:"Muitos acessos. Aguarde um minuto."} });
      if(limit) app.use("/crm/shared-api",publicLimit);
      app.use("/crm/shared-api",express.urlencoded({extended:false,limit:"2kb",parameterLimit:4}));
      const bearer=(req:any)=>{const h=req.get("authorization");return typeof h==="string"&&h.startsWith("Bearer ")?h.slice(7):"";};
      app.get("/crm/shared-api/materials",route(async(req,res)=>{
        const s=await validateLink(o,bearer(req)),files=await openSelection(o,s.fazenda_id,s.items);
        try {
          res.json({title:"Materiais da fazenda",expires_at:s.expira_em,
            items:files.map((f,i)=>({id:i,label:externalName(f,i),kind:f.kind,size:f.size}))});
        } finally {await closeSelection(files);}
      }));
      app.post("/crm/shared-api/download",route(async(req,res)=>{
        const token=req.body?.token,s=await validateLink(o,token);
        let keys:string[],zipped=false;
        if(req.body?.all==="1"){keys=s.items;zipped=true;}
        else {
          const n=Number(req.body?.item);
          check(typeof req.body?.item==="string" && /^\d{1,3}$/.test(req.body.item) && Number.isInteger(n) && n>=0 && n<s.items.length,404,"Arquivo indisponível.");
          keys=[s.items[n]];
        }
        await deliver(res,s.fazenda_id,keys,zipped,async()=>{await validateLink(o,token);},s.items);
      }));
      app.use("/crm/shared-api",(_req,res)=>res.status(404).json({message:"Recurso indisponível."}));
    },
    privateRoutes(app:Express) {
      const base="/crm/api/farms/:id";
      app.get(base+"/materials",route(async(req,res)=>{res.json(await catalog(o,id(req.params.id),who(req)));}));
      uploadRoutes(app,o);
      const guard = (req:any,fid:number) => async()=>{
        const u=(await o.db.query("SELECT * FROM crm_users WHERE id=$1",[who(req).id])).rows[0];
        check(u&&!u.bloqueado&&u.auth_version===req.session.crmAuthVersion,401,"Sua sessão terminou.");
        await canFarm(o.db,publicUser(u),fid);
      };
      app.get(base+"/materials/download",route(async(req,res)=>{
        const fid=id(req.params.id),key=req.query.key;materialKeys([key]);
        await deliver(res,fid,[key as string],false,guard(req,fid));
      }));
      app.get(base+"/materials/zip",route(async(req,res)=>{
        const fid=id(req.params.id);check(typeof req.query.keys==="string"&&req.query.keys.length<=6000,400,"Seleção inválida.");
        let keys: string[];try {keys=materialKeys(JSON.parse(req.query.keys));}catch {check(false,400,"Seleção inválida.");}
        await deliver(res,fid,keys!,true,guard(req,fid));
      }));
      app.get(base+"/material-shares",route(async(req,res)=>{
        const fid=id(req.params.id),u=who(req);await canFarm(o.db,u,fid);
        const rows=(await o.db.query(`SELECT * FROM crm_material_shares WHERE fazenda_id=$1 AND (criado_por=$2 OR $3::boolean)
          ORDER BY criado_em DESC,id DESC LIMIT 100`,[fid,u.id,u.papel==="admin"])).rows;
        res.json({links:rows.map(s=>shareDto(s,u))});
      }));
      app.post(base+"/material-shares",route(async(req,res)=>{
        const fid=id(req.params.id),u=who(req);
        const result=await createLink(o,secret,fid,u,req.body);
        await event(o.db,u,"Link de materiais criado",{link_id:result.link.id},null,fid);res.status(201).json(result);
      }));
      app.delete(base+"/material-shares/:shareId",route(async(req,res)=>{
        const fid=id(req.params.id),u=who(req),sid=id(req.params.shareId);await canFarm(o.db,u,fid);
        const s=(await o.db.query("SELECT * FROM crm_material_shares WHERE id=$1 AND fazenda_id=$2",[sid,fid])).rows[0];
        check(s,404,"Link indisponível.");check(u.papel==="admin"||s.criado_por===u.id,403,"Só o autor ou administrador pode cancelar este link.");
        await o.db.query("UPDATE crm_material_shares SET revogado_em=COALESCE(revogado_em,now()) WHERE id=$1",[sid]);
        await event(o.db,u,"Link de materiais cancelado",{link_id:sid},null,fid);res.json({ok:true});
      }));
    },
  };
}
