import assert from "node:assert/strict";
import { vazaDadoSensivel } from "../lib/sigilo";
import { sanitizarImagem, lerOrientacaoExif, detectarTipo } from "../lib/foto";
import { formaSvgAnonima } from "../lib/forma";
import { faixaNumero, classeRelevo, faixaDistanciaKm, faixaArea } from "../../shared/faixas";
import { estadoAutomatico, estaVencida, validarConfirmacao } from "../../shared/confianca";
import { gerarSlug } from "../lib/slug";
import { validarGeoJsonPoligono } from "../lib/geojson";
import { normalizarImovelHub } from "../lib/hub";
import { anonimizarImovel, ajustarFiltros, filtroSuficiente, tokenDoImovel } from "../lib/pesquisa";
import { atributoParaPublico, projetarFazendaPublica, validarPublicacao, type FazendaRow, type AtributoRow } from "../lib/publico";
import { jpegComExif } from "./helpers";

export async function rodar() {
  // ---- sigilo
  const priv = { municipio: "Botumirim", uf: "MG", car_codigo: "MG-3108107-A1B2C3D4E5F60718293A4B5C6D7E8F90", latitude: -16.8923, longitude: -43.0121 };
  assert.deepEqual(vazaDadoSensivel("Fazenda no Norte de Minas, com boa topografia", priv), []);
  assert.ok(vazaDadoSensivel("Fazenda em Botumirim/MG", priv).some((m) => /município/.test(m)));
  assert.ok(vazaDadoSensivel("fazenda em BOTUMIRIM", priv).length > 0);               // maiúsculas
  assert.ok(vazaDadoSensivel("fazenda em Botumirím", priv).length > 0);               // acento diferente
  assert.ok(vazaDadoSensivel("CAR MG-3108107-A1B2C3D4E5F60718293A4B5C6D7E8F90", priv).length > 0);
  assert.ok(vazaDadoSensivel("localizada em -16.8923, -43.0121", priv).length > 0);
  assert.ok(vazaDadoSensivel("ponto -16.123456 -43.654321", priv).length > 0);        // coordenada qualquer
  assert.ok(vazaDadoSensivel("veja https://maps.app.goo.gl/abc", priv).length > 0);
  assert.ok(vazaDadoSensivel("16°53'12\" S", priv).length > 0);
  assert.deepEqual(vazaDadoSensivel(null, priv), []);

  // ---- foto: GPS/XMP/comentário somem, orientação e JFIF ficam
  const orig = jpegComExif();
  assert.ok(orig.includes(Buffer.from("GPSLatitude")));
  const limpa = sanitizarImagem(orig)!;
  assert.equal(limpa.tipo, "jpeg");
  const s = limpa.dados.toString("latin1");
  for (const proibido of ["GPSLatitude", "GPSLongitude", "LOCALIZACAO-SECRETA", "comentario-com-endereco", "xmpmeta"]) assert.ok(!s.includes(proibido), `restou: ${proibido}`);
  assert.ok(s.includes("JFIF"));
  assert.equal(detectarTipo(limpa.dados), "jpeg");
  const i1 = limpa.dados.indexOf(Buffer.from("Exif\0\0", "latin1"));
  assert.ok(i1 > 0);
  assert.equal(lerOrientacaoExif(limpa.dados.subarray(i1)), 6); // orientação preservada
  assert.ok(limpa.dados.includes(Buffer.from([0xff, 0xda])) && limpa.dados.subarray(-2).equals(Buffer.from([0xff, 0xd9])));
  assert.equal(sanitizarImagem(Buffer.from("<html>não é imagem</html>")), null);
  assert.equal(sanitizarImagem(Buffer.from("GIF89a....")), null);
  // PNG com eXIf/tEXt
  const crc = Buffer.alloc(4);
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); return Buffer.concat([l, Buffer.from(t, "latin1"), d, crc]); };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", Buffer.alloc(13)), chunk("tEXt", Buffer.from("Comment\0GPS-16.9")), chunk("eXIf", Buffer.from("GPSLat")), chunk("IDAT", Buffer.from("dados")), chunk("IEND", Buffer.alloc(0))]);
  const pngLimpo = sanitizarImagem(png)!;
  assert.equal(pngLimpo.tipo, "png");
  assert.ok(!pngLimpo.dados.includes(Buffer.from("GPS")) && pngLimpo.dados.includes(Buffer.from("IDAT")));

  // ---- forma anonimizada: sem coordenadas, dentro da caixa 0..100
  const poly = { type: "Polygon", coordinates: [[[-43.1, -16.9], [-43.0, -16.9], [-43.0, -16.8], [-43.1, -16.8], [-43.1, -16.9]]] };
  const forma = formaSvgAnonima(poly)!;
  assert.match(forma.d, /^M[\d. L]+Z$/);
  const nums = forma.d.match(/[\d.]+/g)!.map(Number);
  assert.ok(nums.every((n) => n >= 0 && n <= 100));
  assert.ok(!forma.d.includes("43") || nums.every((n) => n <= 100)); // nada de lat/lon
  assert.equal(formaSvgAnonima({ type: "Point", coordinates: [0, 0] }), null);

  // ---- faixas
  assert.equal(faixaNumero(847, 100, "m"), "800 a 900 m");
  assert.equal(faixaNumero(1234, 100, "m"), "1.200 a 1.300 m");
  assert.equal(classeRelevo(2), "plano"); assert.equal(classeRelevo(12), "ondulado"); assert.equal(classeRelevo(50), "montanhoso");
  assert.equal(faixaDistanciaKm(4000), "até 5 km"); assert.equal(faixaDistanciaKm(12500), "de 5 a 15 km"); assert.equal(faixaDistanciaKm(90000), "acima de 30 km");
  assert.equal(faixaArea(1454), "1.000 a 2.500 ha");

  // ---- confiança
  assert.equal(estadoAutomatico("indeterminado"), "sem_dado");
  assert.equal(estadoAutomatico("nao_detectado"), "indicado");
  assert.ok(validarConfirmacao({ achado: "detectado", origem: "robo" }));
  assert.equal(validarConfirmacao({ achado: "detectado", origem: "visita" }), null);
  assert.equal(estaVencida("confirmado", "2000-01-01", 30), false);
  assert.equal(estaVencida("indicado", "2000-01-01", 30), true);

  // ---- slug não carrega município/CAR e é único por sufixo
  const sl = gerarSlug("Fazenda Santa Fé", () => "abc12");
  assert.equal(sl, "fazenda-santa-fe-abc12");

  // ---- geojson
  assert.ok(validarGeoJsonPoligono(poly));
  assert.equal(validarGeoJsonPoligono({ type: "Polygon", coordinates: [[[200, 0], [1, 1], [2, 2], [200, 0]]] }), null);
  assert.equal(validarGeoJsonPoligono("{lixo"), null);
  assert.equal(validarGeoJsonPoligono({ type: "Point", coordinates: [0, 0] }), null);

  // ---- Hub: sentinelas viram null
  const h = normalizarImovelHub({ cod_imovel: "MG-1", uf: "mg", num_area: "1454.5", alt_media: -9999, alt_min: -9999, alt_max: -9999, argila_media: -1, argila_pct: null });
  assert.equal(h.alt_media, null); assert.equal(h.argila_media, null); assert.equal(h.area_ha, 1454.5); assert.equal(h.uf, "MG");
  assert.equal(normalizarImovelHub({ cod_imovel: "x", argila_media: null, argila_pct: 31.2 }).argila_media, 31.2);

  // ---- pesquisa: níveis, grade de filtros e token
  const im = { cod_imovel: "MG-3108107-AAAA", uf: "MG", municipio: "Botumirim", area_ha: 1454.4, alt_media: 847.6, alt_min: 800, alt_max: 900, argila_media: 37.46, geojson: { x: 1 } };
  const tk = tokenDoImovel(im.cod_imovel, "seg");
  assert.equal(tk, tokenDoImovel(" mg-3108107-aaaa ", "seg"));
  assert.notEqual(tk, tokenDoImovel(im.cod_imovel, "outro"));
  for (const nivel of ["aberto", "desbloqueado", "completo"] as const) {
    const out = JSON.stringify(anonimizarImovel(im, tk, nivel));
    for (const proibido of ["Botumirim", "3108107", "AAAA", "geojson", "cod_imovel", "municipio"]) assert.ok(!out.includes(proibido), `${nivel} vaza ${proibido}`);
  }
  assert.equal(anonimizarImovel(im, tk, "aberto").area, "1.000 a 2.500 ha");
  assert.equal(anonimizarImovel(im, tk, "aberto").altitude, "800 a 900 m");
  assert.equal(anonimizarImovel(im, tk, "aberto").argila, "30 a 40%");
  assert.equal(anonimizarImovel(im, tk, "desbloqueado").altitude, "800 a 850 m");
  assert.match(anonimizarImovel(im, tk, "completo").area!, /1\.454/);
  const fAberto = ajustarFiltros({ uf: "mg", alt_media_min: 812, alt_media_max: 818, argila_media_min: 33, argila_media_max: 34, area_min: 1400, area_max: 1500 }, "aberto");
  assert.equal(fAberto.alt_media_min, 800); assert.equal(fAberto.alt_media_max, 900);  // filtro estreito é alargado
  assert.equal(fAberto.argila_media_min, 30); assert.equal(fAberto.argila_media_max, 40);
  assert.equal(fAberto.area_min, 1250); assert.equal(fAberto.area_max, 1500);
  assert.equal(ajustarFiltros({ uf: "mg", deslocamento: 99999 }, "aberto").deslocamento, 100);
  assert.equal(filtroSuficiente(ajustarFiltros({ uf: "MG" }, "aberto")), false);
  assert.equal(filtroSuficiente(ajustarFiltros({ area_min: 100 }, "aberto")), false);
  assert.equal(filtroSuficiente(ajustarFiltros({ uf: "MG", area_min: 100 }, "aberto")), true);

  // ---- projeção pública: allowlist
  const fz: FazendaRow = {
    id: 1, slug: "fazenda-x-1", titulo: "Fazenda X", status: "publicada", destaque: false, destaque_ordem: 0,
    descricao_publica: "Boa terra no Norte de Minas.", regiao_publica: "Norte de Minas Gerais", culturas: ["soja"],
    area_ha: 1454, area_exibicao: "exata", preco_exibicao: null, mostrar_mapa: true, whatsapp_proprio: null,
    car_codigo: priv.car_codigo, municipio: "Botumirim", uf: "MG", latitude: -16.8923, longitude: -43.0121,
    geojson: poly, notas_internas: "dono: Fulano 99999-0000", publicado_em: null,
  };
  const at = (chave: string, p: Partial<AtributoRow>): AtributoRow => ({ chave, estado: "indicado", achado: "detectado", valor_json: null, fonte: "Hub", observacao: null, confirmado_por: null, consultado_em: new Date().toISOString(), publico: true, ...p });
  const atributos = [
    at("altitude_media", { valor_json: 847.6 }), at("argila_media", { valor_json: 37.4 }), at("declividade_media", { valor_json: 6 }),
    at("logistica_rodovia", { valor_json: 12500 }), at("energia", { valor_json: "Rede elétrica até 1 km" }),
    at("sobreposicoes", { valor_json: "Terra Indígena X" }),                       // nunca público
    at("agua", { estado: "indicado", achado: "nao_detectado", valor_json: null }),   // ausência por fonte não vira afirmação
    at("benfeitorias", { estado: "sem_dado", achado: "indeterminado" }),
    at("documentacao", { publico: false, valor_json: "Matrícula regular" }),        // não marcado como público
  ];
  const pub = projetarFazendaPublica(fz, atributos, [{ id: 1, arquivo: "a.jpg", legenda: null, ordem: 1, capa: true }]);
  const json = JSON.stringify(pub);
  for (const proibido of ["Botumirim", "3108107", "MG-31", "-16.89", "-43.01", "Fulano", "99999", "Terra Indígena", "notas_internas", "car_codigo", "latitude", "847", "37.4", "12500"]) assert.ok(!json.includes(proibido), `projeção vaza: ${proibido}`);
  assert.deepEqual(pub.atributos.map((a) => a.chave).sort(), ["altitude_media", "argila_media", "declividade_media", "energia", "logistica_rodovia"]);
  assert.equal(pub.atributos.find((a) => a.chave === "altitude_media")!.texto, "800 a 900 m");
  assert.equal(pub.atributos.find((a) => a.chave === "declividade_media")!.texto, "suave ondulado");
  assert.equal(pub.atributos.find((a) => a.chave === "logistica_rodovia")!.texto, "de 5 a 15 km");
  assert.ok(pub.forma && !pub.forma.d.includes("-16"));
  assert.equal(projetarFazendaPublica({ ...fz, mostrar_mapa: false }, [], []).forma, null);
  assert.equal(projetarFazendaPublica({ ...fz, area_exibicao: "faixa" }, [], []).area, "1.000 a 2.500 ha");
  assert.equal(atributoParaPublico(at("ndvi", { valor_json: 0.5 })), null);         // não publicável
  assert.equal(atributoParaPublico(at("uso_solo", { valor_json: { descricao: "~60% vegetação nativa" } }))!.texto, "~60% vegetação nativa");

  // ---- validar publicação
  const fotos = [{ id: 1, arquivo: "a.jpg", legenda: null, ordem: 1, capa: true }];
  assert.deepEqual(validarPublicacao(fz, fotos, atributos.filter((a) => a.publico && a.chave !== "sobreposicoes" && a.estado !== "sem_dado")), []);
  assert.ok(validarPublicacao({ ...fz, descricao_publica: "Linda fazenda em Botumirim" }, fotos, []).length > 0);
  assert.ok(validarPublicacao({ ...fz, titulo: "Fazenda MG-3108107-A1B2C3D4E5F60718293A4B5C6D7E8F90" }, fotos, []).length > 0);
  assert.ok(validarPublicacao(fz, [], []).some((p) => /foto/i.test(p)));
  assert.ok(validarPublicacao({ ...fz, regiao_publica: null }, fotos, []).some((p) => /região/i.test(p)));
  assert.ok(validarPublicacao(fz, [{ ...fotos[0], legenda: "vista de Botumirim" }], []).length > 0);
  assert.ok(validarPublicacao(fz, fotos, [at("sobreposicoes", { valor_json: "x" })]).length > 0);
  assert.ok(validarPublicacao(fz, fotos, [at("energia", { estado: "sem_dado", achado: "indeterminado" })]).length > 0);
  assert.ok(validarPublicacao({ ...fz, geojson: null }, fotos, []).some((p) => /mapa/i.test(p)));
}
