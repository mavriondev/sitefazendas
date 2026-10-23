import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { subirApp, criarHubFalso, jpegComExif } from "./helpers";

const POLI = { type: "Polygon", coordinates: [[[-43.1, -16.9], [-43.0, -16.9], [-43.0, -16.8], [-43.1, -16.8], [-43.1, -16.9]]] };

export async function rodar() {
  const hub = criarHubFalso();
  hub.porCodigo["MG-3108107-AAAA"] = { cod_imovel: "MG-3108107-AAAA", uf: "MG", municipio: "Botumirim", area_ha: 1454.4, alt_media: 847.6, alt_min: 800, alt_max: 900, argila_media: 37.46, geojson: POLI };
  hub.imoveis = [
    { cod_imovel: "MG-3108107-AAAA", uf: "MG", municipio: "Botumirim", area_ha: 1454.4, alt_media: 847.6, alt_min: 800, alt_max: 900, argila_media: 37.46, geojson: null },
    { cod_imovel: "MG-3108107-BBBB", uf: "MG", municipio: "Grão Mogol", area_ha: 800, alt_media: null, alt_min: null, alt_max: null, argila_media: 22, geojson: null },
  ];
  let chamadasIA = 0;
  const fetchIA = (async () => { chamadasIA++; return new Response(JSON.stringify({ content: [{ type: "text", text: "Fazenda no Norte de Minas Gerais, com altitude indicada entre 800 e 900 m." }] }), { status: 200 }); }) as unknown as typeof fetch;
  const t = await subirApp({ hub, fetchIA });
  const { admin, cliente } = t;
  try {
    // ---------- permissões ----------
    const anon = cliente();
    assert.equal((await anon.get("/api/admin/fazendas")).status, 401);
    assert.equal((await anon.put("/api/admin/config", { modulo_pesquisa_ativo: true })).status, 401);

    // ---------- cadastro de comprador ----------
    const ana = cliente();
    assert.equal((await ana.post("/api/auth/registrar", { nome: "Ana", email: "ana@x.com", senha: "curta", whatsapp: "31999990000", aceite: true })).status, 400);
    assert.equal((await ana.post("/api/auth/registrar", { nome: "Ana", email: "ana@x.com", senha: "senha-boa-123", whatsapp: "31999990000", aceite: false })).status, 400);
    assert.equal((await ana.post("/api/auth/registrar", { nome: "Ana", email: "ana@x.com", senha: "senha-boa-123", whatsapp: "123", aceite: true })).status, 400);
    assert.equal((await ana.post("/api/auth/registrar", { nome: "Ana", email: "ana@x.com", senha: "senha-boa-123", whatsapp: "(31) 99999-0000", aceite: true })).status, 201);
    assert.equal((await cliente().post("/api/auth/registrar", { nome: "Ana2", email: "ANA@x.com", senha: "senha-boa-123", whatsapp: "31999990001", aceite: true })).status, 409);
    const eu = await ana.get("/api/auth/eu");
    assert.equal(eu.json.usuario.papel, "comprador"); assert.equal(eu.json.usuario.nivel_acesso, "aberto");
    assert.equal((await ana.get("/api/admin/fazendas")).status, 403);      // comprador não entra no painel
    assert.equal((await ana.put("/api/admin/usuarios/1", { nivel_acesso: "completo" })).status, 403);
    assert.equal((await cliente().post("/api/auth/entrar", { email: "ana@x.com", senha: "errada-errada" })).status, 401);
    assert.equal((await cliente().post("/api/auth/entrar", { email: "nao@existe.com", senha: "qualquer-coisa" })).status, 401);
    const senhaVaza = await ana.get("/api/auth/eu"); assert.ok(!JSON.stringify(senhaVaza.json).includes("hash"));

    // ---------- fazenda: criação, enriquecimento, atributos ----------
    const novo = await admin.post("/api/admin/fazendas", { titulo: "Fazenda Santa Fé", car_codigo: "MG-3108107-AAAA", regiao_publica: "Norte de Minas Gerais", culturas: ["soja", "milho"] });
    assert.equal(novo.status, 201);
    const id = novo.json.id;
    let det = await admin.get(`/api/admin/fazendas/${id}`);
    assert.ok(det.json.problemas_publicacao.length > 0);                   // ainda não publicável
    assert.equal((await admin.post(`/api/admin/fazendas/${id}/status`, { status: "publicada" })).status, 409);

    const enr = await admin.post(`/api/admin/fazendas/${id}/enriquecer`);
    assert.equal(enr.status, 200, enr.texto);
    det = await admin.get(`/api/admin/fazendas/${id}`);
    const alt = det.json.atributos.find((a: any) => a.chave === "altitude_media");
    assert.equal(alt.estado, "indicado"); assert.equal(alt.valor_json, 847.6); assert.equal(alt.publico, false);
    assert.equal(det.json.fazenda.municipio, "Botumirim"); assert.equal(Number(det.json.fazenda.area_ha), 1454.4);
    assert.ok(det.json.fazenda.geojson && det.json.fazenda.latitude != null);

    // confirmação humana não é sobrescrita por nova leitura automática
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/altitude_media`, { achado: "detectado", valor: 850, confirmado_por: "documento" })).status, 200);
    hub.porCodigo["MG-3108107-AAAA"].alt_media = 999;
    await admin.post(`/api/admin/fazendas/${id}/enriquecer`);
    det = await admin.get(`/api/admin/fazendas/${id}`);
    const alt2 = det.json.atributos.find((a: any) => a.chave === "altitude_media");
    assert.equal(alt2.estado, "confirmado"); assert.equal(alt2.valor_json, 850);
    // validações de atributo
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/altitude_media`, { achado: "detectado", valor: "alto" })).status, 400);
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/altitude_media`, { achado: "detectado", valor: 1, confirmado_por: "robo" })).status, 400);
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/sobreposicoes`, { achado: "detectado", valor: "TI X", publico: true })).status, 400); // nunca público
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/inexistente`, { achado: "detectado", valor: 1 })).status, 404);
    await admin.put(`/api/admin/fazendas/${id}/atributos/sobreposicoes`, { achado: "detectado", valor: "TI X (privado)" });
    await admin.put(`/api/admin/fazendas/${id}/atributos/argila_media/publico`, { publico: true });
    await admin.put(`/api/admin/fazendas/${id}/atributos/altitude_media/publico`, { publico: true });
    await admin.put(`/api/admin/fazendas/${id}/atributos/energia`, { achado: "detectado", valor: "Rede elétrica até 1 km", confirmado_por: "vendedor", publico: true });
    assert.equal((await admin.put(`/api/admin/fazendas/${id}/atributos/sobreposicoes/publico`, { publico: true })).status, 400);

    // ---------- texto por IA: sugestão, sem salvar ----------
    const ia = await admin.post(`/api/admin/fazendas/${id}/texto-ia`, {});
    assert.equal(ia.status, 200); assert.match(ia.json.sugestao, /Norte de Minas/); assert.equal(chamadasIA, 1);
    assert.ok(!(await admin.get(`/api/admin/fazendas/${id}`)).json.fazenda.descricao_publica);   // não salvou
    const iaVaza = await subirApp({ fetchIA: (async () => new Response(JSON.stringify({ content: [{ type: "text", text: "Linda fazenda em Botumirim." }] }))) as any, hub });
    const nid = (await iaVaza.admin.post("/api/admin/fazendas", { titulo: "Teste", municipio: "Botumirim" })).json.id;
    const iaV = await iaVaza.admin.post(`/api/admin/fazendas/${nid}/texto-ia`, {});
    assert.equal(iaV.status, 502); assert.match(iaV.json.message, /município/);                   // IA que vaza é barrada
    await iaVaza.fechar();

    // ---------- fotos: EXIF/GPS removido do arquivo gravado ----------
    assert.equal((await admin.upload(`/api/admin/fazendas/${id}/fotos`, Buffer.from("<script>alert(1)</script>"), "x.jpg")).status, 415);
    const up = await admin.upload(`/api/admin/fazendas/${id}/fotos`, jpegComExif(), "IMG_0001.jpg", "image/jpeg", { legenda: "Vista da sede" });
    assert.equal(up.status, 201, up.texto);
    assert.match(up.json.arquivo, /^[a-f0-9]{32}\.jpg$/);                  // nome aleatório, sem nome original
    const gravado = fs.readFileSync(path.join(t.uploadsDir, up.json.arquivo));
    assert.ok(!gravado.includes(Buffer.from("GPSLatitude")) && !gravado.includes(Buffer.from("LOCALIZACAO-SECRETA")));
    const foto = (await admin.get(`/api/admin/fazendas/${id}`)).json.fotos[0];
    assert.equal(foto.capa, true);

    // ---------- publicação: bloqueia vazamento, depois publica ----------
    assert.equal((await admin.put(`/api/admin/fazendas/${id}`, { descricao_publica: "Fazenda em Botumirim, perto da cidade." })).status, 200); // rascunho aceita
    let pub = await admin.post(`/api/admin/fazendas/${id}/status`, { status: "publicada" });
    assert.equal(pub.status, 409); assert.ok(pub.json.problemas.some((p: string) => /município/.test(p)));
    await admin.put(`/api/admin/fazendas/${id}`, { descricao_publica: "Terra plana no Norte de Minas, boa para grãos.", area_exibicao: "exata" });
    pub = await admin.post(`/api/admin/fazendas/${id}/status`, { status: "publicada" });
    assert.equal(pub.status, 200, pub.texto);
    // editar fazenda publicada para vazar é recusado e nada muda
    const edit = await admin.put(`/api/admin/fazendas/${id}`, { descricao_publica: "Fazenda em Botumirim" });
    assert.equal(edit.status, 409);
    assert.equal((await admin.get(`/api/admin/fazendas/${id}`)).json.fazenda.descricao_publica, "Terra plana no Norte de Minas, boa para grãos.");
    assert.equal((await admin.del(`/api/admin/fotos/${foto.id}`)).status, 409);          // não deixa publicada sem foto
    assert.equal((await admin.put(`/api/admin/fotos/${foto.id}`, { legenda: "Sede em Botumirim" })).status, 409);

    // ---------- API pública: nada de dado privado ----------
    const lista = await anon.get("/api/public/fazendas");
    assert.equal(lista.status, 200); assert.equal(lista.json.total, 1);
    const detalhe = await anon.get(`/api/public/fazendas/${lista.json.fazendas[0].slug}`);
    for (const resp of [lista.texto, detalhe.texto, (await anon.get("/api/public/home")).texto, (await anon.get("/api/public/filtros")).texto]) {
      for (const proibido of ["Botumirim", "3108107", "AAAA", "-16.8", "-43.0", "Grão Mogol", "TI X", "car_codigo", "municipio", "latitude", "notas_internas", "847", "850", "999", "1454.4"]) {
        // Procura o conteúdo dos valores, não substrings acidentais de IDs aleatórios de uploads.
        const valores: unknown[] = [];
        const visitar = (v: unknown): void => {
          if (Array.isArray(v)) v.forEach(visitar);
          else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => {
            valores.push(k);
            if (typeof x === "string" && /^\/uploads\/[a-f0-9]{32}\.(jpg|png)$/.test(x)) return;
            visitar(k === "slug" && typeof x === "string" ? x.replace(/-[a-z0-9]{5}$/, "") : x);
          });
          else valores.push(v);
        };
        visitar(JSON.parse(resp));
        assert.ok(!valores.some(v => String(v).includes(proibido)), `API pública vaza "${proibido}"`);
      }
    }
    const d = detalhe.json;
    assert.equal(d.area, null); // cadastro interno não autoriza publicação da área
    assert.deepEqual(d.atributos.map((a: any) => a.chave).sort(), ["altitude_media", "argila_media", "energia"]);
    assert.equal(d.atributos.find((a: any) => a.chave === "altitude_media").texto, "800 a 900 m");
    assert.equal(d.atributos.find((a: any) => a.chave === "altitude_media").confianca, "confirmado");
    assert.equal(d.atributos.find((a: any) => a.chave === "argila_media").confianca, "indicado");
    assert.equal(d.forma, null);                                                  // mapa desligado por padrão
    assert.match(d.fotos[0].url, /^\/uploads\/[a-f0-9]{32}\.jpg$/);
    assert.equal((await anon.get(d.fotos[0].url)).status, 200);
    assert.equal((await anon.get("/uploads/../package.json")).status === 200, false);
    // rascunho/arquivada não aparece
    const outra = (await admin.post("/api/admin/fazendas", { titulo: "Rascunho" })).json.id;
    assert.equal((await anon.get("/api/public/fazendas")).json.total, 1);
    assert.equal((await anon.get(`/api/public/fazendas/${(await admin.get(`/api/admin/fazendas/${outra}`)).json.fazenda.slug}`)).status, 404);

    // ---------- filtros ----------
    await admin.put(`/api/admin/fazendas/${id}/atributos/area_total_ha`, {achado:"detectado",valor:1454.4,publico:true});
    const q = async (qs: string) => (await anon.get(`/api/public/fazendas?${qs}`)).json.total;
    assert.equal(await q("altitude_min=800&altitude_max=900"), 1);
    assert.equal(await q("altitude_min=900"), 0);
    assert.equal(await q("argila_min=30&argila_max=40"), 1);
    assert.equal(await q("argila_min=40"), 0);
    assert.equal(await q("regiao=norte"), 1);
    assert.equal(await q("regiao=sul"), 0);
    assert.equal(await q("cultura=SOJA"), 1);
    assert.equal(await q("cultura=café"), 0);
    assert.equal(await q("area_min=1000&area_max=2000"), 1);
    assert.equal(await q("area_min=2000"), 1); // mesmo bucket, não permite descobrir a área exata
    assert.equal(await q("area_min=2500"), 0);
    assert.equal(await q("altitude_min=abc"), 1);                                    // lixo é ignorado, não quebra

    // ---------- mapa (forma anonimizada) opcional ----------
    await admin.put(`/api/admin/fazendas/${id}`, { mostrar_mapa: true });
    const comMapa = (await anon.get(`/api/public/fazendas/${lista.json.fazendas[0].slug}`)).json;
    assert.ok(comMapa.forma?.d && !/-16|-43/.test(JSON.stringify(comMapa)));

    // ---------- contato / destaque / slides ----------
    assert.equal((await anon.post("/api/public/contato", { nome: "João", whatsapp: "11", fazenda_slug: d.slug })).status, 400);
    assert.equal((await anon.post("/api/public/contato", { nome: "João", whatsapp: "11988887777", fazenda_slug: "nao-existe" })).status, 404);
    assert.equal((await anon.post("/api/public/contato", { nome: "João", whatsapp: "11988887777", fazenda_slug: d.slug, mensagem: "Tenho interesse" })).status, 201);
    assert.equal((await anon.post("/api/public/contato", { nome: "Robô", whatsapp: "11988887777", website: "http://spam" })).json.ok, true);   // isca: finge sucesso
    const contatos = (await admin.get("/api/admin/contatos")).json.contatos;
    assert.equal(contatos.length, 1); assert.equal(contatos[0].origem, "vitrine");
    // As listas avisam quando há mais registros do que o limite mostrado (total e limite acompanham a lista).
    const listaContatos = (await admin.get("/api/admin/contatos")).json;
    assert.equal(listaContatos.total, 1); assert.equal(listaContatos.limite, 500);
    assert.equal(typeof (await admin.get("/api/admin/apresentacoes")).json.total, "number");
    assert.ok((await admin.get("/api/admin/usuarios")).json.total >= 1);
    assert.equal((await anon.get("/api/admin/contatos")).status, 401);
    await admin.put(`/api/admin/fazendas/${id}`, { destaque: true });
    assert.equal((await anon.get("/api/public/home")).json.destaques.length, 1);
    assert.equal((await admin.post("/api/admin/slides", { titulo: "x", link_tipo: "url", url: "javascript:alert(1)" })).status, 400);
    const sl = await admin.post("/api/admin/slides", { titulo: "Destaque", subtitulo: "Terras", link_tipo: "fazenda", fazenda_id: id, ordem: 1 });
    assert.equal(sl.status, 201);
    const home = (await anon.get("/api/public/home")).json;
    assert.equal(home.slides.length, 1); assert.equal(home.slides[0].link, `/fazenda/${d.slug}`);

    // ---------- módulo B: interruptor no servidor ----------
    const cfgPublica = await anon.get("/api/public/config");
    assert.equal(cfgPublica.json.modulo_pesquisa_ativo, false);
    const chamadasAntes = hub.chamadas;
    const busca = { uf: "MG", area_min: 700, area_max: 1600 };
    assert.equal((await ana.post("/api/pesquisa/buscar", busca)).status, 404);          // desligado: some
    assert.equal((await admin.post("/api/pesquisa/buscar", busca)).status, 404);        // até para admin
    assert.equal(hub.chamadas, chamadasAntes);                                          // e NÃO chamou a Hub
    assert.equal((await anon.post("/api/pesquisa/buscar", busca)).status, 404);

    assert.equal((await admin.put("/api/admin/config", { modulo_pesquisa_ativo: "sim" })).status, 400);
    assert.equal((await admin.put("/api/admin/config", { modulo_pesquisa_ativo: true })).status, 200);
    assert.equal((await anon.post("/api/pesquisa/buscar", busca)).status, 401);          // exige login
    assert.equal((await ana.post("/api/pesquisa/buscar", { uf: "MG" })).status, 400);    // exige critério
    const r1 = await ana.post("/api/pesquisa/buscar", busca);
    assert.equal(r1.status, 200, r1.texto);
    assert.equal(r1.json.resultados.length, 2); assert.equal(r1.json.nivel, "aberto");
    for (const proibido of ["Botumirim", "Grão Mogol", "3108107", "AAAA", "BBBB", "geojson", "cod_imovel", "municipio", "1454", "847", "37.4"]) assert.ok(!r1.texto.includes(proibido), `pesquisa vaza "${proibido}"`);
    assert.equal(r1.json.resultados[0].area, "1.000 a 2.500 ha");
    assert.equal(r1.json.resultados[0].altitude, "800 a 900 m");
    assert.equal(r1.json.resultados[1].altitude, null);                                  // sem dado ≠ valor inventado
    // níveis
    const usuarios = (await admin.get("/api/admin/usuarios")).json.usuarios;
    const idAna = usuarios.find((u: any) => u.email === "ana@x.com").id;
    await admin.put(`/api/admin/usuarios/${idAna}`, { nivel_acesso: "completo" });
    const r2 = await ana.post("/api/pesquisa/buscar", busca);
    assert.match(r2.json.resultados[0].area, /1\.454/); assert.match(r2.json.resultados[0].argila, /37,5/);
    for (const proibido of ["Botumirim", "3108107", "AAAA", "geojson", "cod_imovel"]) assert.ok(!r2.texto.includes(proibido), `nível completo vaza "${proibido}"`);
    // interesse vira contato para o corretor, que vê o CAR real
    const token = r2.json.resultados[0].token;
    assert.equal((await ana.post("/api/pesquisa/interesse", { token: "inventado" })).status, 404);
    assert.equal((await ana.post("/api/pesquisa/interesse", { token, mensagem: "Quero saber mais" })).status, 201);
    assert.equal((await ana.post("/api/pesquisa/interesse", { token })).json.repetido, true);
    const ct = (await admin.get("/api/admin/contatos")).json.contatos.find((c: any) => c.origem === "pesquisa");
    assert.equal(ct.pesquisa_cod_imovel, "MG-3108107-AAAA"); assert.equal(ct.nome, "Ana");
    // registro de apresentação (proteção da comissão)
    const ap = await admin.post("/api/admin/apresentacoes", { comprador_nome: "Ana", pesquisa_token: token, canal: "WhatsApp" });
    assert.equal(ap.status, 201); assert.ok(ap.json.apresentado_em);
    assert.equal((await admin.post("/api/admin/apresentacoes", { comprador_nome: "Ana" })).status, 400);
    // limite por hora
    await admin.put("/api/admin/config", { pesquisa_limite_hora: 2 });
    await ana.post("/api/pesquisa/buscar", busca);
    assert.equal((await ana.post("/api/pesquisa/buscar", busca)).status, 429);
    // desligar de novo: some na hora, mas o enriquecimento da vitrine (módulo A) continua funcionando
    await admin.put("/api/admin/config", { modulo_pesquisa_ativo: false });
    assert.equal((await ana.post("/api/pesquisa/buscar", busca)).status, 404);
    assert.equal((await ana.post("/api/pesquisa/interesse", { token })).status, 404);
    const antes = hub.chamadas;
    assert.equal((await admin.post(`/api/admin/fazendas/${id}/enriquecer`)).status, 200);
    assert.equal(hub.chamadas, antes + 1);

    // ---------- usuário bloqueado perde acesso na hora ----------
    await admin.put(`/api/admin/usuarios/${idAna}`, { bloqueado: true });
    assert.equal((await ana.get("/api/auth/eu")).json.usuario, null);
    assert.equal((await admin.put("/api/admin/usuarios/1", { bloqueado: true })).status, 400); // admin não se bloqueia

    // ---------- filtros: só atributos públicos, na mesma faixa que a vitrine mostra ----------
    const filtrar = async (q: string) => (await anon.get(`/api/public/fazendas?${q}`)).json.total as number;
    assert.equal(await filtrar("altitude_min=700&altitude_max=900"), 1);
    assert.equal(await filtrar("altitude_min=851"), 1);          // 851 vira 800: não revela que o valor real é 850
    assert.equal(await filtrar("altitude_min=900"), 0);
    assert.equal(await filtrar("altitude_max=850"), 1);          // 850 sobe para 900: não revela o valor real
    assert.equal(await filtrar("altitude_max=799"), 0);
    assert.equal(await filtrar("altitude_max=900"), 1);
    assert.equal(await filtrar("com_energia=1"), 1);
    assert.equal(await filtrar("com_agua=1"), 0);
    assert.equal(await filtrar("relevo=plano"), 0);
    assert.equal(await filtrar("ordem=maior_area"), 1);
    await admin.put(`/api/admin/fazendas/${id}/atributos/altitude_media/publico`, { publico: false });
    assert.equal(await filtrar("altitude_min=700&altitude_max=900"), 0);  // atributo privado não é filtrável
    await admin.put(`/api/admin/fazendas/${id}/atributos/altitude_media/publico`, { publico: true });
    assert.equal(await filtrar("altitude_min=700&altitude_max=900"), 1);

    // ---------- parceiros, contato e venda ----------
    assert.equal((await anon.post("/api/admin/parceiros", { nome: "X" })).status, 401);
    assert.equal((await admin.post("/api/admin/parceiros", { nome: "" })).status, 400);
    assert.equal((await admin.post("/api/admin/parceiros", { nome: "Marca", url: "javascript:alert(1)" })).status, 400);
    const pid = (await admin.post("/api/admin/parceiros", { nome: "Marca Parceira", url: "https://exemplo.com", ordem: 1 })).json.id;
    assert.equal((await admin.upload(`/api/admin/parceiros/${pid}/logo`, jpegComExif())).status, 200);
    const pubParc = (await anon.get("/api/public/parceiros")).json.parceiros;
    assert.equal(pubParc.length, 1);
    assert.ok(pubParc[0].logo.startsWith("/uploads/"));
    assert.equal((await fetch(`${t.base}${pubParc[0].logo}`)).status, 200);   // logo de parceiro ativo é público
    await admin.put(`/api/admin/parceiros/${pid}`, { nome: "Marca Parceira", ativo: false });
    assert.equal((await anon.get("/api/public/parceiros")).json.parceiros.length, 0);
    assert.equal((await anon.get(pubParc[0].logo)).status, 404);              // inativo some, inclusive o arquivo
    assert.equal((await admin.del(`/api/admin/parceiros/${pid}`)).status, 200);
    assert.ok((await anon.get("/api/public/config")).json.sobre_texto.length > 20);
    assert.equal((await admin.put("/api/admin/config", { instagram_url: "http://x" })).status, 400);
    assert.equal((await admin.put("/api/admin/config", { sobre_titulo: "Quem somos", contato_email: "a@b.com" })).status, 200);
    assert.equal((await anon.post("/api/public/contato", { tipo: "anuncio", nome: "Vendedor", whatsapp: "62999990000", regiao_fazenda: "Rio Verde", area_fazenda: "1200 ha", car_fazenda: "GO-1", mensagem: "Quero vender" })).status, 201);
    assert.equal((await anon.post("/api/public/contato", { nome: "Curioso", whatsapp: "62999990001", mensagem: "Dúvida" })).status, 201);
    const cs = (await admin.get("/api/admin/contatos")).json.contatos;
    const anun = cs.find((c: any) => c.origem === "anuncio");
    assert.ok(anun && anun.mensagem.includes("Rio Verde") && anun.mensagem.includes("CAR: GO-1"));
    assert.ok(cs.some((c: any) => c.origem === "contato"));
    assert.ok((await anon.get("/sitemap.xml")).texto.includes("/sobre"));

    // ---------- senha: trocar, redefinir por link do admin ----------
    const bia = cliente();
    await bia.post("/api/auth/registrar", { nome: "Bia", email: "bia@x.com", senha: "senha-boa-123", whatsapp: "31999991111", aceite: true });
    assert.equal((await bia.put("/api/auth/senha", { senha_atual: "errada", senha_nova: "nova-senha-456" })).status, 400);
    assert.equal((await bia.put("/api/auth/senha", { senha_atual: "senha-boa-123", senha_nova: "curta" })).status, 400);
    assert.equal((await bia.put("/api/auth/senha", { senha_atual: "senha-boa-123", senha_nova: "nova-senha-456" })).status, 200);
    assert.equal((await cliente().post("/api/auth/entrar", { email: "bia@x.com", senha: "nova-senha-456" })).status, 200);
    const idBia = (await admin.get("/api/admin/usuarios")).json.usuarios.find((u: any) => u.email === "bia@x.com").id;
    assert.equal((await bia.post(`/api/admin/usuarios/${idBia}/link-senha`)).status, 403);   // só admin gera link
    const lk = await admin.post(`/api/admin/usuarios/${idBia}/link-senha`);
    assert.equal(lk.status, 200);
    const tok = String(lk.json.caminho).split("token=")[1];
    assert.equal((await anon.post("/api/auth/redefinir", { token: "x".repeat(48), senha: "outra-senha-789" })).status, 400);
    assert.equal((await anon.post("/api/auth/redefinir", { token: tok, senha: "curta" })).status, 400);
    assert.equal((await anon.post("/api/auth/redefinir", { token: tok, senha: "outra-senha-789" })).status, 200);
    assert.equal((await anon.post("/api/auth/redefinir", { token: tok, senha: "outra-senha-000" })).status, 400);  // uso único
    assert.equal((await cliente().post("/api/auth/entrar", { email: "bia@x.com", senha: "outra-senha-789" })).status, 200);
    const lk2 = await admin.post(`/api/admin/usuarios/${idBia}/link-senha`);
    await t.db.query("UPDATE usuarios SET reset_expira = now() - interval '1 minute' WHERE id=$1", [idBia]);
    assert.equal((await anon.post("/api/auth/redefinir", { token: String(lk2.json.caminho).split("token=")[1], senha: "outra-senha-789" })).status, 400); // expirado

    // ---------- excluir usuário (LGPD) ----------
    assert.equal((await bia.get("/api/auth/eu")).json.usuario, null); // redefinição encerrou a sessão antiga
    assert.equal((await bia.post("/api/auth/entrar", { email: "bia@x.com", senha: "outra-senha-789" })).status, 200);
    await bia.post("/api/public/contato", { nome: "Bia", whatsapp: "31999991111", mensagem: "oi" });
    assert.equal((await admin.del("/api/admin/usuarios/1")).status, 400);                      // não exclui a si mesmo
    assert.equal((await bia.del(`/api/admin/usuarios/${idBia}`)).status, 403);
    assert.equal((await admin.del(`/api/admin/usuarios/${idBia}`)).status, 200);
    assert.equal((await cliente().post("/api/auth/entrar", { email: "bia@x.com", senha: "outra-senha-789" })).status, 401);
    const cts = (await admin.get("/api/admin/contatos")).json.contatos;
    assert.ok(cts.every((c: any) => c.nome !== "Bia" && c.mensagem !== "oi"));                  // contatos anonimizados

    // foto publicada: aberta a todos e com cache
    const fotoPub = (await admin.get(`/api/admin/fazendas/${id}`)).json.fotos[0].arquivo;
    const rf = await fetch(`${t.base}/uploads/${fotoPub}`);
    assert.equal(rf.status, 200);
    assert.ok(String(rf.headers.get("cache-control")).includes("max-age"));

    // ---------- mapa de região, robots, sitemap ----------
    await admin.put(`/api/admin/fazendas/${id}`, { latitude: -16.89, longitude: -43.01, mostrar_regiao: true });
    const dr = (await anon.get(`/api/public/fazendas/${d.slug}`)).json;
    assert.ok(dr.regiao_mapa && dr.regiao_mapa.raio_km >= 10);
    assert.notEqual(dr.regiao_mapa.lat, -16.89);
    assert.ok(!JSON.stringify(dr).includes("-16.89") && !JSON.stringify(dr).includes("-43.01"));
    const rb = await anon.get("/robots.txt");
    assert.ok(rb.texto.includes("Disallow: /admin") && rb.texto.includes("Sitemap:"));
    const sm = await anon.get("/sitemap.xml");
    assert.ok(sm.texto.includes(`/fazenda/${d.slug}`) && !sm.texto.includes("admin"));

    // polígono manual (fazenda sem CAR) preenche o ponto de referência privado
    const semCar = (await admin.post("/api/admin/fazendas", { titulo: "Sem CAR" })).json.id;
    assert.equal((await admin.put(`/api/admin/fazendas/${semCar}`, { geojson: "{ruim" })).status, 400);
    assert.equal((await admin.put(`/api/admin/fazendas/${semCar}`, { geojson: POLI })).status, 200);
    const fz2 = (await admin.get(`/api/admin/fazendas/${semCar}`)).json.fazenda;
    assert.ok(fz2.geojson && fz2.latitude != null);
    assert.equal((await admin.del(`/api/admin/fazendas/${semCar}`)).status, 200);

    // ---------- excluir fazenda ----------
    assert.equal((await admin.del(`/api/admin/fazendas/${id}`)).status, 409);                   // publicada: não exclui direto

    // ---------- arquivar tira da vitrine ----------
    await admin.post(`/api/admin/fazendas/${id}/status`, { status: "arquivada" });
    assert.equal((await anon.get("/api/public/fazendas")).json.total, 0);
    assert.equal((await anon.get(`/api/public/fazendas/${d.slug}`)).status, 404);
    assert.equal((await anon.get("/api/public/home")).json.slides.length, 0);       // slide e sua imagem saem junto com a fazenda
    assert.equal((await anon.get("/sitemap.xml")).texto.includes(d.slug), false);          // arquivada sai do sitemap
    // foto de fazenda não publicada: só o admin abre
    const fotoArq = (await admin.get(`/api/admin/fazendas/${id}`)).json.fotos[0].arquivo;
    assert.equal((await anon.get(`/uploads/${fotoArq}`)).status, 404);
    assert.equal((await admin.get(`/uploads/${fotoArq}`)).status, 200);
    assert.equal((await anon.get("/uploads/..%2f..%2fetc%2fpasswd")).status, 404);
    assert.equal((await admin.del(`/api/admin/fazendas/${id}`)).status, 200);
    assert.equal((await admin.get(`/api/admin/fazendas/${id}`)).status, 404);
  } finally {
    await t.fechar();
  }
}
