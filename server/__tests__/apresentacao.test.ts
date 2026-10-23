import assert from "node:assert/strict";
import { subirApp } from "./helpers";
import { gravarManual } from "../lib/atributos-db";
import { aplicarApresentacao, hashApresentacao, limparMarcacoesDemo, limparTextosEditoriais, planejarApresentacao } from "../lib/apresentacao";

export async function rodar() {
  assert.equal(limparMarcacoesDemo("[EXEMPLO] Fazenda Verde"),"Fazenda Verde");
  assert.equal(limparMarcacoesDemo("Sudeste (demonstração)"),"Sudeste");
  assert.equal(limparMarcacoesDemo("R$ 9.800.000 (valor de exemplo)"),"R$ 9.800.000");
  assert.equal(limparMarcacoesDemo("Energia elétrica simulada para testes."),"Energia elétrica.");
  assert.equal(limparMarcacoesDemo("Atividade fictícia: soja, milho."),"Atividade: soja, milho.");
  assert.equal(limparMarcacoesDemo("Foto ilustrativa de exemplo — não é a propriedade."),"");
  assert.equal(limparMarcacoesDemo("Imagem ilustrativa"),"");
  assert.equal(limparMarcacoesDemo("Slide de exemplo: fazenda fictícia com lavoura de soja e milho."),"Fazenda com lavoura de soja e milho.");
  assert.equal(limparMarcacoesDemo("Slide de exemplo: propriedade fictícia para testar o carrossel."),"Conheça os detalhes desta propriedade.");
  assert.equal(limparMarcacoesDemo("Por exemplo, confirme a documentação."),"Por exemplo, confirme a documentação.");
  assert.equal(limparMarcacoesDemo("Texto  editado pelo dono.\n\n"),"Texto  editado pelo dono.\n\n");
  assert.equal(limparMarcacoesDemo("Informações sujeitas à confirmação."),"Informações sujeitas à confirmação.");
  const texto = "ANÚNCIO FICTÍCIO PARA TESTES — não representa uma propriedade disponível para compra. Fazenda de demonstração para simular soja e milho e testar os filtros do catálogo. Área, preço, características e infraestrutura são inteiramente simulados, sem verificação documental. As fotografias são paisagens ilustrativas, não imagens deste imóvel. Não há CAR, município ou localização real cadastrados.";
  assert.equal(limparMarcacoesDemo(texto),"Fazenda com vocação para soja e milho.");
  assert.equal(limparMarcacoesDemo(limparMarcacoesDemo(texto)),limparMarcacoesDemo(texto));
  const tecnico = { url:"https://site.test/exemplo",slug:"exemplo-verde",rastreamento:{ga4_id:"G-DEMO123456"},titulo:"[DEMO] Campo" };
  assert.deepEqual(limparTextosEditoriais(tecnico),{...tecnico,titulo:"Campo"});
  const t = await subirApp();
  try {
    const d = await t.db.query<{id:number}>("INSERT INTO fazendas(slug,titulo,descricao_publica,regiao_publica,preco_exibicao,notas_internas) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      ["demo-campo","[DEMO] Fazenda Campo",texto,"Cerrado (demonstração)","R$ 1.000.000 (fictício)","Registro de demonstração: manter nota interna."]);
    const id = d.rows[0].id;
    const real = await t.db.query<{id:number}>("INSERT INTO fazendas(slug,titulo,descricao_publica) VALUES($1,$2,$3) RETURNING id",
      ["campo-real","Fazenda Real","Por exemplo, converse com o corretor."]);
    await t.db.query("INSERT INTO fazenda_fotos(fazenda_id,arquivo,legenda,ordem,capa) VALUES($1,$2,$3,0,true)",[id,"foto.jpg","Foto ilustrativa de exemplo — não é a propriedade."]);
    await gravarManual(t.db,id,"energia",{achado:"detectado",valor:"Energia elétrica simulada para testes.",publico:true});
    await t.db.query("INSERT INTO configuracoes(chave,valor) VALUES('seo_site',$1::jsonb) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",[JSON.stringify(tecnico)]);
    const plano = await planejarApresentacao(t.db);
    assert.ok(plano.length >= 7);
    assert.equal(hashApresentacao(plano),hashApresentacao(await planejarApresentacao(t.db)));
    assert.ok(!plano.some(m=>m.tabela==="fazendas"&&m.id===real.rows[0].id));
    assert.ok(!plano.some(m=>["slug","arquivo","notas_internas"].includes(m.coluna)));
    // Edição concorrente aborta tudo; não sobrescreve o texto recém-editado.
    await t.db.query("UPDATE fazendas SET titulo='Título editado pelo dono' WHERE id=$1",[id]);
    await t.db.query("BEGIN");
    await assert.rejects(()=>aplicarApresentacao(t.db,plano),/Conteúdo mudou/);
    await t.db.query("ROLLBACK");
    assert.equal((await t.db.query("SELECT titulo FROM fazendas WHERE id=$1",[id])).rows[0].titulo,"Título editado pelo dono");
    await t.db.query("UPDATE fazendas SET titulo='[DEMO] Fazenda Campo' WHERE id=$1",[id]);
    const novoPlano = await planejarApresentacao(t.db);
    await t.db.query("BEGIN");await aplicarApresentacao(t.db,novoPlano);await t.db.query("COMMIT");
    const f = (await t.db.query("SELECT * FROM fazendas WHERE id=$1",[id])).rows[0];
    assert.equal(f.titulo,"Fazenda Campo");
    assert.equal(f.descricao_publica,"Fazenda com vocação para soja e milho.");
    assert.equal(f.slug,"demo-campo");
    assert.equal(f.notas_internas,"Registro de demonstração: manter nota interna.");
    assert.equal((await t.db.query("SELECT legenda FROM fazenda_fotos WHERE fazenda_id=$1",[id])).rows[0].legenda,null);
    assert.equal((await t.db.query("SELECT valor_json FROM fazenda_atributos WHERE fazenda_id=$1",[id])).rows[0].valor_json,"Energia elétrica.");
    assert.deepEqual((await t.db.query("SELECT valor FROM configuracoes WHERE chave='seo_site'")).rows[0].valor,{...tecnico,titulo:"Campo"});
    assert.equal((await planejarApresentacao(t.db)).length,0,"aplicação é idempotente");
    await assert.rejects(()=>aplicarApresentacao(t.db,[{tabela:"fazendas",id,coluna:"slug",antes:"demo-campo",depois:"outro"}]),/fora do escopo/);
  } finally { await t.fechar(); }
}
