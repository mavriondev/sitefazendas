import type { FileHandle } from "node:fs/promises";
import type { Response } from "express";
import { check } from "./security";

export interface OpenMaterial { handle: FileHandle; size: number; name: string; mime: string }
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
export function crc32(buf: Buffer, previous = 0) {
  let c = previous ^ -1; for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0;
}
async function write(res: Response, b: Buffer) {
  if (res.destroyed) throw Error("Download interrompido.");
  if (!res.write(b)) await new Promise<void>((resolve,reject)=>{
    const cleanup=()=>{res.removeListener("drain",ok);res.removeListener("close",closed);res.removeListener("error",bad);};
    const ok=()=>{cleanup();resolve();};
    const bad=(e:Error)=>{cleanup();reject(e);};
    const closed=()=>bad(Error("Download interrompido."));
    res.once("drain",ok);res.once("close",closed);res.once("error",bad);
  });
}
async function* chunks(file: OpenMaterial, res: Response, validate: () => Promise<void>) {
  let pos = 0, last = 0;
  while (pos < file.size) {
    if (res.destroyed) throw Error("Download interrompido.");
    if (Date.now() - last > 1000) { await validate(); last = Date.now(); }
    const b = Buffer.allocUnsafe(Math.min(64 * 1024, file.size - pos));
    const r = await file.handle.read(b, 0, b.length, pos);
    check(r.bytesRead > 0, 503, "Arquivo incompleto.");
    pos += r.bytesRead; yield b.subarray(0, r.bytesRead);
  }
}
export async function sendMaterial(res: Response, file: OpenMaterial, validate: () => Promise<void>) {
  await validate(); res.attachment(file.name); res.type(file.mime); res.setHeader("Content-Length", file.size);
  for await (const b of chunks(file, res, validate)) await write(res, b);
  res.end();
}
/** ZIP STORE com descritores/CRC, memória limitada a um bloco por vez, sem processos externos. */
export async function sendZip(res: Response, files: OpenMaterial[], maxBytes: number, validate: () => Promise<void>) {
  check(files.length > 0 && files.length <= 100, 400, "Selecione de 1 a 100 arquivos.");
  check(files.reduce((n, f) => n + f.size, 0) <= maxBytes && maxBytes <= 2 * 1024 ** 3, 413, "O pacote excede o limite. Baixe menos arquivos por vez.");
  await validate();
  res.attachment("materiais-da-fazenda.zip"); res.type("application/zip");
  const central: Buffer[] = []; let offset = 0;
  for (const f of files) {
    await validate();
    const name = Buffer.from(f.name, "utf8"), start = offset, header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x808, 6);
    header.writeUInt16LE(33, 12); header.writeUInt16LE(name.length, 26);
    await write(res, header); await write(res, name); offset += header.length + name.length;
    let crc = 0;
    for await (const b of chunks(f, res, validate)) { crc = crc32(b, crc); await write(res, b); offset += b.length; }
    const dd = Buffer.alloc(16); dd.writeUInt32LE(0x08074b50); dd.writeUInt32LE(crc, 4); dd.writeUInt32LE(f.size, 8); dd.writeUInt32LE(f.size, 12);
    await write(res, dd); offset += dd.length;
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0x808,8);
    c.writeUInt16LE(33,14); c.writeUInt32LE(crc,16); c.writeUInt32LE(f.size,20); c.writeUInt32LE(f.size,24); c.writeUInt16LE(name.length,28); c.writeUInt32LE(start,42);
    central.push(c, name);
  }
  const centralSize = central.reduce((n,b)=>n+b.length,0);
  for (const b of central) await write(res,b);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(centralSize,12); end.writeUInt32LE(offset,16); await write(res,end); res.end();
}
