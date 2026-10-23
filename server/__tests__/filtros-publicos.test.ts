import assert from "node:assert/strict";
import { subirApp } from "./helpers";
import { gravarManual } from "../lib/atributos-db";

export async function rodar() {
  const t=await subirApp();
  try {
    const {db}=t, anon=t.cliente();
    const criar=async(titulo:string,status="publicada",uf="MG")=>(await db.query("INSERT INTO fazendas (slug,titulo,status,uf,municipio,car_codigo,latitude,longitude,area_ha,area_exibicao,regiao_publica) VALUES ($1,$2,$3,$4,'MunicipioPrivado','CAR-NAO-PUBLICAR',-18.123456,-46.123456,1487.23,'exata','Região ampla fictícia') RETURNING id",[titulo.toLowerCase(),titulo,status,uf])).rows[0].id;
    const a=await criar("Alpha"),b=await criar("Beta"),oculta=await criar("Oculta"),rascunho=await criar("Rascunho","rascunho");
    await db.query("UPDATE fazendas SET mostrar_regiao=true WHERE id=$1",[a]);
    const attr=async(id:number,chave:string,valor:unknown,publico=true)=>gravarManual(db,id,chave,{achado:"detectado",valor,publico});
    for(const [id,area,alt,arg] of [[a,1454.4,812.3,36.2],[b,2193.8,897.5,39.8]]) {
      await attr(id,"estado_publico","MG");await attr(id,"area_total_ha",area);
      await attr(id,"altitude_media",alt);await attr(id,"argila_media",arg);
      await attr(id,"agua","Poço informado");await attr(id,"energia","Rede informada");
    }
    for(const id of [oculta,rascunho]) {
      await attr(id,"estado_publico","BA",id===rascunho);
      await attr(id,"altitude_media",1234,id===rascunho);
      await attr(id,"argila_media",61,id===rascunho);
      await attr(id,"area_total_ha",9567,id===rascunho);
      await attr(id,"agua","Texto privado",false);await attr(id,"energia","Texto privado",false);
    }
    const get=async(q="")=>{const r=await anon.get("/api/public/fazendas?"+q);assert.equal(r.status,200);return r.json;};
    assert.equal((await get()).total,3);
    assert.equal((await get("uf=MG")).total,2);
    assert.equal((await get("uf=BA")).total,0); // não deriva da UF privada nem usa atributo oculto
    assert.equal((await get("regiao_brasil=sudeste")).total,2);
    assert.equal((await get("regiao_brasil=nordeste")).total,0);
    assert.equal((await get("uf=MG&regiao_brasil=sul")).total,0);
    for(const q of ["area_faixa=1000_2500","altitude_faixa=800_900","argila_faixa=35_40","com_agua=1&com_energia=1","uf=MG&area_faixa=1000_2500&altitude_faixa=800_900&argila_faixa=35_40&com_agua=1&com_energia=1"]) assert.equal((await get(q)).total,2,q);
    for(const q of ["area_faixa=5000_10000","altitude_faixa=1200_1300","argila_faixa=60_65"]) assert.equal((await get(q)).total,0,q);
    // Limites arbitrários de URLs legadas não podem afunilar o número exato.
    for(const q of ["area_min=1450","area_min=2190","area_max=1460","area_max=2200","altitude_min=811","altitude_min=896","argila_min=36","argila_min=39"]) assert.equal((await get(q)).total,2,q);
    const maior=(await get("area_faixa=1000_2500&ordem=maior_area")).fazendas.map((f:any)=>f.slug);
    const menor=(await get("area_faixa=1000_2500&ordem=menor_area")).fazendas.map((f:any)=>f.slug);
    assert.deepEqual(maior,menor); // mesma faixa, não ordena pelo dado privado
    const op=(await anon.get("/api/public/filtros")).json;
    assert.deepEqual(op.estados.map((e:any)=>e.uf),["MG"]);
    assert.deepEqual(op.regioes_brasil.map((e:any)=>e.id),["sudeste"]);
    assert.deepEqual(op.faixas.area.map((e:any)=>e.id),["1000_2500"]);
    assert.deepEqual(op.faixas.altitude.map((e:any)=>e.id),["800_900"]);
    assert.deepEqual(op.faixas.argila.map((e:any)=>e.id),["35_40"]);
    const all=JSON.stringify({op,lista:await get(),detalhe:(await anon.get("/api/public/fazendas/alpha")).json});
    for(const secreto of ["MunicipioPrivado","CAR-NAO-PUBLICAR","18.123456","46.123456","1487.23","1454.4","2193.8","812.3","897.5","36.2","39.8","Texto privado"]) assert.ok(!all.includes(secreto),secreto);
    assert.equal((await get("uf=MG")).fazendas[0].area,"1.000 a 2.500 ha");
    for(const f of (await get("uf=MG")).fazendas) {assert.equal(f.regiao_mapa,null);assert.equal(f.forma,null);}
    assert.equal((await anon.get("/api/public/fazendas?area_faixa=1454_1455")).status,400);
    assert.equal((await anon.get("/api/public/fazendas?altitude_faixa=812_813")).status,400);
    assert.equal((await anon.get("/api/public/fazendas?argila_faixa=36_37")).status,400);
    assert.equal((await anon.get("/api/public/fazendas?uf=ZZ")).status,400);
    assert.equal((await anon.get("/api/public/fazendas?regiao_brasil=municipio")).status,400);
    assert.equal((await t.admin.put(`/api/admin/fazendas/${a}/atributos/estado_publico`,{achado:"detectado",valor:"Estado inventado"})).status,400);
    // Desmarcar autorizações remove opções e resultados imediatamente.
    for(const id of [a,b]) await db.query("UPDATE fazenda_atributos SET publico=false WHERE fazenda_id=$1",[id]);
    assert.equal((await get("uf=MG")).total,0);
    assert.equal((await get("com_energia=1")).total,0);
    assert.deepEqual((await anon.get("/api/public/filtros")).json.estados,[]);
    assert.deepEqual((await anon.get("/api/public/filtros")).json.faixas.area,[]);
    assert.equal((await get()).fazendas.find((f:any)=>f.slug==="alpha").area,null);
    // Dado legado malformado não derruba consulta nem aparece nas opções.
    await db.query("UPDATE fazenda_atributos SET publico=true,valor_json='\"texto inválido\"'::jsonb WHERE fazenda_id=$1 AND chave='altitude_media'",[a]);
    assert.equal((await get("altitude_faixa=800_900")).total,0);
  } finally {await t.fechar();}
}
