// Sanitização de fotos: remove metadados (EXIF/GPS, XMP, IPTC) que revelariam onde a fazenda fica.
// Mantém só a orientação (EXIF Orientation), para a foto não sair deitada. Sem dependências nativas.

export type TipoImagem = "jpeg" | "png";

export function detectarTipo(buf: Buffer): TipoImagem | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  return null;
}

/** Lê a orientação (1..8) do EXIF, ou null. */
export function lerOrientacaoExif(app1: Buffer): number | null {
  // app1 = conteúdo do segmento APP1 (começa com "Exif\0\0")
  if (app1.length < 14 || app1.toString("latin1", 0, 6) !== "Exif\0\0") return null;
  const tiff = app1.subarray(6);
  const le = tiff.toString("latin1", 0, 2) === "II";
  if (!le && tiff.toString("latin1", 0, 2) !== "MM") return null;
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  try {
    const ifd = u32(4);
    if (ifd + 2 > tiff.length) return null;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > tiff.length) return null;
      if (u16(e) === 0x0112) {
        const v = u16(e + 8);
        return v >= 1 && v <= 8 ? v : null;
      }
    }
  } catch { /* EXIF malformado */ }
  return null;
}

function exifSoOrientacao(o: number): Buffer {
  const b = Buffer.alloc(6 + 8 + 2 + 12 + 4);
  b.write("Exif\0\0", 0, "latin1");
  b.write("MM", 6, "latin1");
  b.writeUInt16BE(0x002a, 8);
  b.writeUInt32BE(8, 10);
  b.writeUInt16BE(1, 14);          // 1 entrada
  b.writeUInt16BE(0x0112, 16);     // Orientation
  b.writeUInt16BE(3, 18);          // SHORT
  b.writeUInt32BE(1, 20);
  b.writeUInt16BE(o, 24);
  b.writeUInt32BE(0, 28);          // sem próximo IFD
  return b;
}

function limparJpeg(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 2)];
  let orient: number | null = null;
  let i = 2;
  let inseriu = false;
  const inserirExif = () => {
    if (inseriu || orient === null || orient === 1) return;
    const seg = exifSoOrientacao(orient);
    const cab = Buffer.from([0xff, 0xe1, 0, 0]);
    cab.writeUInt16BE(seg.length + 2, 2);
    out.push(cab, seg);
    inseriu = true;
  };
  while (i < buf.length) {
    if (buf[i] !== 0xff) { out.push(buf.subarray(i)); break; } // dados inesperados: copia o resto
    let marker = buf[i + 1];
    while (marker === 0xff && i + 2 < buf.length) { i++; marker = buf[i + 1]; } // preenchimento
    if (marker === 0xda || marker === 0xd9) { // início dos dados da imagem / fim
      inserirExif();
      out.push(buf.subarray(i));
      return Buffer.concat(out);
    }
    if (marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.subarray(i, i + 2 + len);
    const dados = buf.subarray(i + 4, i + 2 + len);
    const ehExif = marker === 0xe1 && dados.toString("latin1", 0, 6) === "Exif\0\0";
    const ehXmp = marker === 0xe1 && dados.toString("latin1", 0, 28).startsWith("http://ns.adobe.com/xap");
    const ehApp = marker >= 0xe1 && marker <= 0xef; // APP1..APP15 (EXIF, XMP, IPTC=APP13, etc.)
    const ehComentario = marker === 0xfe;
    if (ehExif) orient = lerOrientacaoExif(dados);
    // Mantém APP0 (JFIF) e APP2 (perfil ICC); descarta o resto dos metadados e comentários.
    const manter = !(ehExif || ehXmp || ehComentario || (ehApp && marker !== 0xe2));
    if (manter) out.push(seg);
    i += 2 + len;
  }
  inserirExif();
  return Buffer.concat(out);
}

function limparPng(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const tipo = buf.toString("latin1", i + 4, i + 8);
    const fim = i + 12 + len;
    if (fim > buf.length) break;
    if (!["eXIf", "tEXt", "iTXt", "zTXt", "tIME"].includes(tipo)) out.push(buf.subarray(i, fim));
    i = fim;
    if (tipo === "IEND") break;
  }
  return Buffer.concat(out);
}

/** Devolve a imagem sem metadados, ou null se não for JPEG/PNG. */
export function sanitizarImagem(buf: Buffer): { dados: Buffer; tipo: TipoImagem } | null {
  const tipo = detectarTipo(buf);
  if (!tipo) return null;
  try {
    return { dados: tipo === "jpeg" ? limparJpeg(buf) : limparPng(buf), tipo };
  } catch {
    return null; // arquivo corrompido: rejeita em vez de gravar sem limpar
  }
}
