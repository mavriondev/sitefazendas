import assert from "node:assert/strict";
import { subirApp } from "./helpers";
import { idYoutube } from "../../shared/youtube";
import { validarPublicacao } from "../lib/publico";

export async function rodar() {
  for(const url of ["https://youtu.be/aqz-KE-bpKQ","https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=12","https://youtube.com/shorts/aqz-KE-bpKQ","https://youtube.com/live/aqz-KE-bpKQ","https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ"]) assert.equal(idYoutube(url),"aqz-KE-bpKQ");
  for(const url of ["https://youtube.com.evil.test/watch?v=aqz-KE-bpKQ","javascript:alert(1)","https://youtu.be/x","https://user:secret@youtube.com/watch?v=aqz-KE-bpKQ","https://example.com/aqz-KE-bpKQ","<iframe>"]) assert.equal(idYoutube(url),null);
  const t=await subirApp();
  try {
    const {admin,cliente,db}=t;
    const id=(await admin.post("/api/admin/fazendas",{titulo:"Fazenda de teste de vídeos"})).json.id;
    const path=`/api/admin/fazendas/${id}/videos`;
    assert.equal((await cliente().post(path,{titulo:"Teste",url:"https://youtu.be/aqz-KE-bpKQ"})).status,401);
    assert.equal((await admin.post(path,{titulo:"Teste",url:"https://evil.test"})).status,400);
    assert.equal((await admin.post(path,{titulo:"",url:"https://youtu.be/aqz-KE-bpKQ"})).status,400);
    const primeiro=await admin.post(path,{titulo:"Sobrevoo autorizado",url:"https://youtu.be/aqz-KE-bpKQ",ordem:2,publico:true});
    assert.equal(primeiro.status,201,primeiro.texto);
    const privado=await admin.post(path,{titulo:"Rascunho privado",url:"https://youtube.com/shorts/aqz-KE-bpKQ",ordem:1});
    assert.equal(privado.status,201);
    const detalhe=(await admin.get(`/api/admin/fazendas/${id}`)).json;
    assert.equal(detalhe.videos.length,2);
    assert.equal(detalhe.videos[0].publico,false);
    assert.equal((await cliente().get(`/api/public/fazendas/${detalhe.fazenda.slug}`)).status,404);
    // Fixture mínima: não corresponde a anúncio real. Testa a allowlist pública independentemente de fotos.
    await db.query("UPDATE fazendas SET status='publicada' WHERE id=$1",[id]);
    let publica=(await cliente().get(`/api/public/fazendas/${detalhe.fazenda.slug}`)).json;
    assert.equal(publica.videos.length,1);
    assert.deepEqual(Object.keys(publica.videos[0]).sort(),["id","titulo","youtube_id"]);
    assert.equal((await admin.put(`/api/admin/videos/${primeiro.json.id}`,{titulo:"Vídeo revisado",ordem:0})).status,200);
    assert.equal((await cliente().get(`/api/public/fazendas/${detalhe.fazenda.slug}`)).json.videos[0].titulo,"Vídeo revisado");
    assert.equal((await admin.put(`/api/admin/videos/${primeiro.json.id}`,{publico:false})).status,200);
    assert.equal((await cliente().get(`/api/public/fazendas/${detalhe.fazenda.slug}`)).json.videos.length,0);
    await db.query("UPDATE fazendas SET municipio='Botumirim' WHERE id=$1",[id]);
    assert.equal((await admin.put(`/api/admin/videos/${primeiro.json.id}`,{titulo:"Localização em Botumirim",publico:true})).status,409);
    const f=(await db.query("SELECT * FROM fazendas WHERE id=$1",[id])).rows[0];
    assert.ok(validarPublicacao(f,[],[],[{titulo:"Vista de Botumirim",publico:true}]).some(p=>p.includes("vídeo")));
    assert.equal((await admin.del(`/api/admin/videos/${privado.json.id}`)).status,200);
    assert.equal((await admin.del(`/api/admin/videos/${privado.json.id}`)).status,404);
    await db.query("DELETE FROM fazendas WHERE id=$1",[id]);
    assert.equal((await db.query("SELECT * FROM fazenda_videos WHERE fazenda_id=$1",[id])).rowCount,0);
  } finally {await t.fechar();}
}
