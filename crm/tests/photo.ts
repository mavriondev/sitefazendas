import { deflateSync } from "node:zlib";

// Paisagem geométrica sintética, nunca uma foto ou informação de imóvel real.
export function syntheticPhoto(width = 800, height = 450) {
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]), length = Buffer.alloc(4), sum = Buffer.alloc(4);
    length.writeUInt32BE(data.length); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const rows = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let color = [166, 201, 207];
    if ((x - width * .77) ** 2 + (y - height * .22) ** 2 < (height * .07) ** 2) color = [244, 219, 158];
    if (y > height * (.45 + .12 * Math.sin(x / width * 6))) color = [94, 134, 100];
    if (y > height * (.72 + .12 * Math.cos(x / width * 5))) color = [66, 105, 76];
    const off = y * (width * 3 + 1) + 1 + x * 3;
    rows.set(color, off);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
