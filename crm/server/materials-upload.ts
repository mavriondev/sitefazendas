import type { Express, Request } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { createReadStream, createWriteStream, unlink } from "node:fs";
import { pipeline } from "node:stream";
import fs from "node:fs/promises";
import path from "node:path";
import { check, canFarm, who, publicUser, id, uuid, asyncRoute as route, event, Fault } from "./security";
import { inspectMaterial, privateName, privateRoot, limitsOf, MiB } from "./materials-storage";
import type { MaterialContext } from "./materials-catalog";

export function uploadRoutes(app: Express, o: MaterialContext) {
  const limits = limitsOf(o); let active = 0;
  const users = new Set<number>();
  const storage: multer.StorageEngine = {
    _handleFile(req,file,cb) {
      const name=crypto.randomBytes(24).toString("hex")+".upload",filePath=path.join((req as any).materialIncoming,name);
      (req as any).materialTemp=filePath;
      const out=createWriteStream(filePath,{flags:"wx",mode:0o600});let size=0;
      file.stream.on("data",(b:Buffer)=>{size+=b.length;});
      const abort=()=>file.stream.destroy(new Fault(400,"Envio interrompido."));
      req.once("aborted",abort);
      pipeline(file.stream,out,e=>{
        req.removeListener("aborted",abort);
        if(e){unlink(filePath,()=>cb(e));return;}
        cb(null,{destination:(req as any).materialIncoming,filename:name,path:filePath,size});
      });
    },
    _removeFile(_req,file,cb) {unlink(file.path,e=>cb(e?.code==="ENOENT"?null:e));},
  };
  const upload = multer({ storage, limits: { fileSize: Math.max(limits.video_bytes, limits.file_bytes), files:1, fields:0, parts:1 } }).single("arquivo");
  app.post("/crm/api/farms/:id/materials", route(async (req,res) => {
    const fid = id(req.params.id), user = who(req), requestKey = uuid(req.get("X-Request-Key"));
    await canFarm(o.db,user,fid);
    check(o.dir,503,"O armazenamento privado de materiais do CRM ainda não está configurado.");
    check(active < 2 && !users.has(user.id),429,"Já há um envio em andamento. Aguarde antes de tentar novamente.");
    active++; users.add(user.id);
    let stored: string | null = null, persisted = false;
    const cleanup = () => { const tmp = (req as any).materialTemp; if (tmp) void fs.unlink(tmp).catch(()=>{}); };
    req.once("aborted", cleanup);
    req.setTimeout(10 * 60000, () => req.destroy());
    try {
      const root = await privateRoot(o.dir,true), incoming = path.join(root,".incoming");
      await fs.mkdir(incoming,{mode:0o700}); // pasta já existente é tratada abaixo
      (req as any).materialIncoming = incoming;
    } catch (e: any) {
      if (e.code !== "EEXIST") { active--; users.delete(user.id); req.removeListener("aborted",cleanup); throw e; }
      (req as any).materialIncoming = path.join(path.resolve(o.dir),".incoming");
    }
    try {
      const incoming = await privateRoot((req as any).materialIncoming);
      (req as any).materialIncoming = incoming;
      await new Promise<void>((ok,fail) => {
        const abort=()=>fail(new Fault(400,"Envio interrompido."));
        req.once("aborted",abort);
        upload(req,res,e=>{req.removeListener("aborted",abort);e?fail(e):ok();});
      });
      check(!req.aborted && req.file && req.file.size > 0,400,"Escolha um arquivo.");
      const file = req.file;
      await fs.chmod(file.path,0o600);
      const format = await inspectMaterial(file.path,file.originalname);
      check(file.size <= (format.kind === "video" ? limits.video_bytes : limits.file_bytes),413,"O arquivo excede o limite deste formato.");
      const hash = crypto.createHash("sha256");
      for await (const b of createReadStream(file.path)) { check(!req.aborted,400,"Envio interrompido."); hash.update(b); }
      const digest = hash.digest("hex"), name = privateName(Buffer.from(file.originalname,"latin1").toString("utf8"));
      const current=(await o.db.query("SELECT * FROM crm_users WHERE id=$1",[user.id])).rows[0];
      check(current&&!current.bloqueado&&current.auth_version===(req.session as any).crmAuthVersion,401,"Sua sessão terminou durante o envio.");
      await canFarm(o.db,publicUser(current),fid);
      const row = await o.db.transaction(async tx => {
        await tx.query("SELECT id FROM crm_farms WHERE id=$1 FOR UPDATE",[fid]);
        const old = (await tx.query("SELECT * FROM crm_materials WHERE criado_por=$1 AND request_key=$2",[user.id,requestKey])).rows[0];
        if (old) {
          check(!old.deleted_at && old.fazenda_id === fid && old.content_hash === digest,409,"Esta tentativa já foi usada em outro envio ou o arquivo foi removido.");
          return old;
        }
        const same = (await tx.query("SELECT * FROM crm_materials WHERE fazenda_id=$1 AND content_hash=$2 AND deleted_at IS NULL",[fid,digest])).rows[0];
        if (same) return same;
        const usage = (await tx.query("SELECT COALESCE(SUM(tamanho),0) AS bytes,COUNT(*) AS total FROM crm_materials WHERE fazenda_id=$1 AND deleted_at IS NULL",[fid])).rows[0];
        check(Number(usage.total)<500 && Number(usage.bytes)+file.size <= (o.farmQuota ?? 5*1024*MiB),413,"Limite de armazenamento desta fazenda atingido.");
        const filename = crypto.randomBytes(24).toString("hex")+"."+format.ext;
        stored = path.join(path.resolve(o.dir!),filename);
        await fs.link(file.path,stored); // mesma partição; nunca sobrescreve um arquivo existente
        return (await tx.query(`INSERT INTO crm_materials(fazenda_id,arquivo,nome,mime,ext,kind,tamanho,content_hash,criado_por,request_key)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[fid,filename,name,format.mime,format.ext,format.kind,file.size,digest,user.id,requestKey])).rows[0];
      });
      persisted = true;
      await event(o.db,user,"Material enviado",{material_id:row.id},null,fid);
      res.status(201).json({id:row.id,key:`m:${row.id}`});
    } catch(e: any) {
      if (e.code === "LIMIT_FILE_SIZE") throw new Fault(413,"O arquivo excede o limite de envio configurado.");
      throw e;
    } finally {
      active--; users.delete(user.id); req.removeListener("aborted",cleanup);
      await fs.unlink((req as any).materialTemp ?? "").catch(()=>{});
      if (stored && !persisted) await fs.unlink(stored).catch(()=>{});
    }
  }));
  app.delete("/crm/api/farms/:id/materials/:materialId",route(async(req,res)=>{
    const fid=id(req.params.id),mid=id(req.params.materialId),u=who(req);await canFarm(o.db,u,fid);
    const m=(await o.db.query("SELECT * FROM crm_materials WHERE id=$1 AND fazenda_id=$2",[mid,fid])).rows[0];
    check(m,404,"Material não encontrado.");check(u.papel==="admin"||m.criado_por===u.id,403,"Só o autor ou administrador pode remover este material.");
    await o.db.transaction(async tx=>{
      await tx.query("UPDATE crm_materials SET deleted_at=COALESCE(deleted_at,now()) WHERE id=$1",[mid]);
      await tx.query("UPDATE crm_material_shares SET revogado_em=COALESCE(revogado_em,now()) WHERE fazenda_id=$1 AND items @> $2::jsonb",[fid,JSON.stringify([`m:${mid}`])]);
    });
    let warning: string | null=null;
    if (o.dir && /^[a-f0-9]{48}\.(mp4|mov|webm|pdf|jpg|png)$/.test(m.arquivo)) {
      try { const root=await privateRoot(o.dir);await fs.unlink(path.join(root,m.arquivo)); }
      catch(e:any) { if(e.code!=="ENOENT") warning="Material removido da lista e links cancelados. A limpeza do arquivo em disco precisa ser conferida."; }
    }
    await event(o.db,u,"Material removido",{material_id:mid},null,fid);res.json({ok:true,warning});
  }));
}
