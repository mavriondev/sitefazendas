import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { fixture, TEST_PASSWORD, PDF } from "./fixture";
import { crc32 } from "../server/materials-zip";
import { separateDirectory } from "../server/materials-storage";

export function syntheticVideo(bytes=128) {
  const box=(type:string,data:Buffer)=>{const b=Buffer.alloc(8);b.writeUInt32BE(data.length+8);b.write(type,4);return Buffer.concat([b,data]);};
  return Buffer.concat([box("ftyp",Buffer.from("isom\0\0\0\0isommp42")),box("moov",box("free",Buffer.alloc(1))),box("mdat",Buffer.alloc(bytes,7))]);
}
function zipContents(b:Buffer) {
  const end=b.length-22;assert.equal(b.readUInt32LE(end),0x06054b50);
  let pos=b.readUInt32LE(end+16);const out=new Map<string,Buffer>();
  for(let i=0;i<b.readUInt16LE(end+10);i++){
    assert.equal(b.readUInt32LE(pos),0x02014b50);
    const size=b.readUInt32LE(pos+24),local=b.readUInt32LE(pos+42),len=b.readUInt16LE(pos+28);
    const name=b.toString("utf8",pos+46,pos+46+len);
    const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28),body=b.subarray(start,start+size);
    assert.equal(body.length,size);assert.equal(crc32(body),b.readUInt32LE(pos+16));
    out.set(name,body);pos+=46+len+b.readUInt16LE(pos+30)+b.readUInt16LE(pos+32);
  }
  assert.equal(pos,end);return out;
}
export async function materialsReview(){
  const f=await fixture(undefined,false,{limits:{video_bytes:16384,file_bytes:4096,zip_bytes:64*1024*1024,max_items:100}}),admin=f.client(),outsider=f.client();
  const fingerprint=await f.sourceFingerprint();
  const fail=(r:any,status:number)=>assert.equal(r.status,status,r.text);
  const newKey=()=>crypto.randomUUID();
  let loginCookie="",csrfToken="";
  try{
    assert.equal(crc32(Buffer.from("123456789")),0xcbf43926);
    assert.throws(()=>separateDirectory("/tmp/site/uploads/nested",["/tmp/site/uploads"]));
    assert.throws(()=>separateDirectory("/tmp/site",["/tmp/site/docs"]));
    fail(await outsider.get("/farms/1/materials"),401);
    // Sessão sintética completa, sem credenciais reais ou variáveis da produção.
    let r=await fetch(f.base+"/crm/api/csrf");loginCookie=r.headers.get("set-cookie")!.split(";")[0];csrfToken=(await r.json()).token;
    r=await fetch(f.base+"/crm/api/login",{method:"POST",headers:{cookie:loginCookie,"x-csrf-token":csrfToken,"content-type":"application/json"},body:JSON.stringify({email:"gestor@crm.test",senha:TEST_PASSWORD})});
    assert.equal(r.status,200);loginCookie=r.headers.get("set-cookie")!.split(";")[0];
    await admin.post("/login",{email:"gestor@crm.test",senha:TEST_PASSWORD});
    // A função upload precisa do CSRF da mesma sessão do cookie.
    const tokenResponse=await fetch(f.base+"/crm/api/csrf",{headers:{cookie:loginCookie}});
    csrfToken=(await tokenResponse.json()).token;
    const uploadFile=async(name:string,data:Buffer,key=newKey(),farm=1,csrf=true)=>{
      const body=new FormData();body.append("arquivo",new Blob([Uint8Array.from(data)]),name);
      const response=await fetch(f.base+`/crm/api/farms/${farm}/materials`,{method:"POST",headers:{cookie:loginCookie,...(csrf?{"x-csrf-token":csrfToken}:{}),"x-request-key":key},body});
      const json=await response.json();return {status:response.status,json,text:JSON.stringify(json)};
    };
    fail(await uploadFile("arquivo.pdf",PDF,newKey(),1,false),403);
    fail(await uploadFile("executavel.html",Buffer.from("<script>0</script>")),415);
    fail(await uploadFile("enganoso.mp4",Buffer.from("não é vídeo")),415);
    fail(await uploadFile("grande.mp4",syntheticVideo(17000)),413);
    const rk=newKey(),video=syntheticVideo();
    const sent=await uploadFile("Video privado do proprietário.mp4",video,rk);fail(sent,201);const mk=sent.json.key;
    assert.equal((await uploadFile("Video privado do proprietário.mp4",video,rk)).json.id,sent.json.id);
    assert.equal((await uploadFile("Outra tentativa.mp4",video)).json.id,sent.json.id);
    fail(await uploadFile("Outro.mp4",syntheticVideo(129),rk),409);
    assert.equal((await f.db.query("SELECT COUNT(*) AS n FROM crm_materials")).rows[0].n,1);
    const doc=await uploadFile("Documento com CAR e município.pdf",PDF);fail(doc,201);
    const cat=(await admin.get("/farms/1/materials")).json;
    assert.equal(cat.items.length,4);assert.ok(cat.items.some((x:any)=>x.key==="d:1"));assert.ok(cat.items.some((x:any)=>x.kind==="video"));
    assert.equal(cat.pdf_url,"https://portal.test/fazenda/fazenda-horizonte/pdf");
    const member=(await admin.post("/users",{nome:"Acesso isolado",email:"isolado@crm.test",senha:TEST_PASSWORD,request_key:newKey()})).json;
    await outsider.post("/login",{email:member.email,senha:TEST_PASSWORD});
    fail(await outsider.get("/farms/1/materials"),404);
    fail(await outsider.get(`/farms/1/materials/download?key=${mk}`),404);
    fail(await outsider.post("/farms/1/material-shares",{keys:[mk],reviewed:true,days:1,request_key:newKey()}),404);
    fail(await admin.get(`/farms/2/materials/download?key=${mk}`),404);
    fail(await admin.get("/farms/2/materials/download?key=d:1"),404);
    fail(await admin.get(`/farms/1/materials/download?key=${encodeURIComponent("p:../../runtime.json")}`),400);
    fail(await admin.post("/farms/1/material-shares",{keys:[mk],days:1,request_key:newKey()}),400);
    fail(await admin.post("/farms/1/material-shares",{keys:[],reviewed:true,days:1,request_key:newKey()}),400);
    fail(await admin.post("/farms/1/material-shares",{keys:[mk],reviewed:true,days:31,request_key:newKey()}),400);
    fail(await admin.post("/farms/1/material-shares",{keys:[mk,"d:99"],reviewed:true,days:1,request_key:newKey()}),404);
    const body={keys:[mk],reviewed:true,days:1,request_key:newKey()};
    const share=await admin.post("/farms/1/material-shares",body);fail(share,201);
    assert.deepEqual((await admin.post("/farms/1/material-shares",body)).json,share.json);
    fail(await admin.post("/farms/1/material-shares",{...body,days:2}),409);
    const token=share.json.path.split("#")[1],headers={authorization:`Bearer ${token}`};
    const publicGet=()=>fetch(f.base+"/crm/shared-api/materials",{headers});
    r=await publicGet();assert.equal(r.status,200);assert.match(r.headers.get("cache-control")!,/no-store/);assert.match(r.headers.get("x-robots-tag")!,/noindex/);
    const info=await r.json();assert.equal(info.items.length,1);assert.equal(info.items[0].label,"Vídeo 1.mp4");
    assert.doesNotMatch(JSON.stringify(info),/proprietário|Horizonte|município|CAR|Matrícula|arquivo|fazenda_id|token/i);
    const saved=(await f.db.query("SELECT * FROM crm_material_shares")).rows[0];assert.ok(saved.token_hash);assert.ok(!JSON.stringify(saved).includes(token));
    const lists=(await admin.get("/farms/1/material-shares")).json;assert.ok(!JSON.stringify(lists).includes(token));
    const download=async(fields:Record<string,string>)=>fetch(f.base+"/crm/shared-api/download",{method:"POST",body:new URLSearchParams({token,...fields})});
    r=await download({item:"0"});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),video);
    r=await download({item:"1"});assert.equal(r.status,404);
    r=await download({all:"1"});assert.equal(r.status,200);
    const zip=zipContents(Buffer.from(await r.arrayBuffer()));assert.equal(zip.size,1);assert.deepEqual([...zip.values()][0],video);
    const ownZip=await admin.get("/farms/1/materials/zip?keys="+encodeURIComponent(JSON.stringify([mk,"d:1"])));
    fail(ownZip,200);assert.equal(zipContents(ownZip.buffer).size,2);
    await admin.put(`/users/${member.id}/access`,{fazenda_ids:[1],contato_ids:[]});
    fail(await outsider.get("/farms/1/materials"),200);
    fail(await outsider.del(`/farms/1/materials/${sent.json.id}`),403);
    const teamLink=await outsider.post("/farms/1/material-shares",{...body,request_key:newKey()});fail(teamLink,201);
    await admin.put(`/users/${member.id}/access`,{fazenda_ids:[],contato_ids:[]});
    r=await fetch(f.base+"/crm/shared-api/materials",{headers:{authorization:`Bearer ${teamLink.json.path.split("#")[1]}`}});assert.equal(r.status,404);
    const sourceDocBefore=await fs.readFile(path.join(f.siteDocsDir,"0123456789abcdef0123456789abcdef0123456789abcdef.pdf"));
    await admin.del(`/farms/1/material-shares/${share.json.link.id}`);r=await publicGet();assert.equal(r.status,404);
    r=await download({all:"1"});assert.equal(r.status,404);assert.doesNotMatch(r.headers.get("content-type")!,/zip/);
    const expired=await admin.post("/farms/1/material-shares",{...body,request_key:newKey()});
    await f.db.query("UPDATE crm_material_shares SET expira_em=now()-interval '1 minute' WHERE id=$1",[expired.json.link.id]);
    r=await fetch(f.base+"/crm/shared-api/materials",{headers:{authorization:`Bearer ${expired.json.path.split("#")[1]}`}});assert.equal(r.status,404);
    // Se um arquivo escolhido sumir, o pacote inteiro falha antes de emitir um ZIP incompleto.
    const docShare=await admin.post("/farms/1/material-shares",{...body,keys:[mk,"d:1"],request_key:newKey()});
    const pdfPath=path.join(f.siteDocsDir,"0123456789abcdef0123456789abcdef0123456789abcdef.pdf");
    await fs.rename(pdfPath,pdfPath+".test-backup");
    r=await fetch(f.base+"/crm/shared-api/download",{method:"POST",body:new URLSearchParams({token:docShare.json.path.split("#")[1],all:"1"})});
    assert.equal(r.status,404);assert.doesNotMatch(r.headers.get("content-type")!,/zip/);await fs.rename(pdfPath+".test-backup",pdfPath);
    f.failSource(true);assert.ok((await admin.get("/farms/1/materials")).json.warning);f.failSource(false);
    const stopped=await admin.post("/farms/1/material-shares",{...body,request_key:newKey()});
    await admin.del(`/farms/1/materials/${sent.json.id}`);
    r=await fetch(f.base+"/crm/shared-api/materials",{headers:{authorization:`Bearer ${stopped.json.path.split("#")[1]}`}});assert.equal(r.status,404);
    fail(await admin.get(`/farms/1/materials/download?key=${mk}`),404);
    fail(await uploadFile("Video privado do proprietário.mp4",video,rk),409);
    assert.deepEqual(await fs.readFile(pdfPath),sourceDocBefore);
    assert.equal(await f.sourceFingerprint(),fingerprint);
    // Interrupção real de multipart: remove temporários e não deixa a vaga de envio presa.
    const boundary="synthetic-multipart-boundary";
    await new Promise<void>((resolve,reject)=>{
      const q=http.request(f.base+"/crm/api/farms/1/materials",{method:"POST",headers:{cookie:loginCookie,"x-csrf-token":csrfToken,"x-request-key":newKey(),"content-type":`multipart/form-data; boundary=${boundary}`}},()=>reject(Error("Envio incompleto não deveria terminar.")));
      q.on("error",()=>resolve());q.write(`--${boundary}\r\nContent-Disposition: form-data; name="arquivo"; filename="interrompido.mp4"\r\nContent-Type: video/mp4\r\n\r\n`);
      q.write(video);setTimeout(()=>q.destroy(),50);
    });
    await new Promise(r=>setTimeout(r,120));
    assert.deepEqual(await fs.readdir(path.join(f.dir,"materials-private",".incoming")),[]);
    const permissionDuringUpload=await new Promise<number>((resolve,reject)=>{
      const q=http.request(f.base+"/crm/api/farms/1/materials",{method:"POST",headers:{cookie:loginCookie,"x-csrf-token":csrfToken,"x-request-key":newKey(),"content-type":`multipart/form-data; boundary=${boundary}`}},r=>{r.resume();r.on("end",()=>resolve(r.statusCode!));});
      q.on("error",reject);q.write(`--${boundary}\r\nContent-Disposition: form-data; name="arquivo"; filename="sem-acesso.mp4"\r\nContent-Type: video/mp4\r\n\r\n`);q.write(syntheticVideo(140));
      setTimeout(()=>{f.db.query("UPDATE crm_users SET papel='membro' WHERE id=1").then(()=>q.end(`\r\n--${boundary}--\r\n`)).catch(reject);},60);
    });
    await f.db.query("UPDATE crm_users SET papel='admin' WHERE id=1");
    assert.equal(permissionDuringUpload,404);
    assert.deepEqual(await fs.readdir(path.join(f.dir,"materials-private",".incoming")),[]);
    fail(await uploadFile("Novo envio.mp4",syntheticVideo(130)),201);
    // Arquivo sintético grande para produzir backpressure real, sem depender da velocidade de um arquivo pequeno.
    const large=syntheticVideo(20*1024*1024),filename=crypto.randomBytes(24).toString("hex")+".mp4";
    await fs.writeFile(path.join(f.dir,"materials-private",filename),large,{mode:0o600});
    const big=(await f.db.query(`INSERT INTO crm_materials(fazenda_id,arquivo,nome,mime,ext,kind,tamanho,content_hash,criado_por,request_key)
      VALUES(1,$1,'Vídeo sintético','video/mp4','mp4','video',$2,$3,1,$4) RETURNING id`,[filename,large.length,crypto.createHash("sha256").update(large).digest("hex"),newKey()])).rows[0];
    const paused=()=>new Promise<http.IncomingMessage>((resolve,reject)=>{const q=http.get(f.base+`/crm/api/farms/1/materials/download?key=m:${big.id}`,{headers:{cookie:loginCookie}},p=>{p.pause();resolve(p);});q.on("error",reject);});
    const simultaneous=await Promise.all([paused(),paused()]);
    try{assert.ok(simultaneous.every(p=>p.statusCode===200));fail(await admin.get(`/farms/1/materials/download?key=m:${big.id}`),429);}
    finally{simultaneous.forEach(p=>p.destroy());}
    await new Promise(r=>setTimeout(r,100));
    const resumed=await paused();assert.equal(resumed.statusCode,200);resumed.destroy();
    await new Promise(r=>setTimeout(r,100));
    const liveShare=await admin.post("/farms/1/material-shares",{...body,keys:[`m:${big.id}`],request_key:newKey()});fail(liveShare,201);
    const data=new URLSearchParams({token:liveShare.json.path.split("#")[1],item:"0"}).toString();
    const activeResponse=await new Promise<http.IncomingMessage>((resolve,reject)=>{
      const q=http.request(f.base+"/crm/shared-api/download",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","content-length":Buffer.byteLength(data)}},p=>{p.pause();resolve(p);});q.on("error",reject);q.end(data);
    });
    assert.equal(activeResponse.statusCode,200);
    await admin.del(`/farms/1/material-shares/${liveShare.json.link.id}`);
    await new Promise(r=>setTimeout(r,1100));
    const interrupted=await new Promise<{bytes:number;aborted:boolean}>((resolve)=>{
      let bytes=0;activeResponse.on("data",b=>bytes+=b.length);
      activeResponse.on("error",()=>resolve({bytes,aborted:true}));activeResponse.on("end",()=>resolve({bytes,aborted:false}));activeResponse.resume();
    });
    assert.equal(interrupted.aborted,true);assert.ok(interrupted.bytes<large.length);
    assert.equal(await f.sourceFingerprint(),fingerprint);
    console.log("✓ Materiais: uploads privados, formato/limite, CSRF, ACL, retries, ZIP/CRC, seleção externa, expiração, revogação ativa, origem somente leitura e envios/downloads interrompidos ou simultâneos.");
  }finally{await f.close();}
}
if(import.meta.url===`file://${process.argv[1]}`)await materialsReview();
