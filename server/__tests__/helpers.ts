process.env.ANTHROPIC_API_KEY = "chave-de-teste";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Db } from "../db";
import { migrar } from "../schema";
import { criarApp } from "../app";
import { garantirAdmin } from "../auth";
import type { Hub, HubImovel, SobreposicaoHub, HubResultado } from "../lib/hub";
import type { FontesMalha } from "../lib/ibge-malha";

export async function criarDbTeste(): Promise<Db> {
  const pg = new PGlite();
  const db: Db = {
    async query(text, params) {
      const r = await pg.query(text, params as any[]);
      return { rows: r.rows as any[], rowCount: r.affectedRows || r.rows.length };
    },
  };
  await migrar(db);
  return db;
}

export interface HubFalso extends Hub { chamadas: number; imoveis: HubImovel[]; porCodigo: Record<string, HubImovel>; ti: HubResultado<SobreposicaoHub>; uc: HubResultado<SobreposicaoHub> }
/** Fontes do IBGE que nunca saem para a internet nos testes: tudo "não respondeu". */
export const malhaOffline: FontesMalha = { wfs: async () => ({ ok: false, features: [], truncado: false }), extensao: async () => null };
export function criarHubFalso(): HubFalso {
  const h: HubFalso = {
    chamadas: 0, imoveis: [], porCodigo: {},
    ti: { ok: true, data: { sobrepoe: false, itens: [] } }, uc: { ok: true, data: { sobrepoe: false, itens: [] } },
    async sobreposicaoTerraIndigena() { return h.ti; },
    async sobreposicaoUnidadeConservacao() { return h.uc; },
    configurado: () => true,
    async buscarPorCodigo(cod) { h.chamadas++; return { ok: true, data: h.porCodigo[cod] ?? null }; },
    async buscar() { h.chamadas++; return { ok: true, data: { total: h.imoveis.length, imoveis: h.imoveis } }; },
  };
  return h;
}

export async function subirApp(opts: { hub?: Hub; fetchIA?: typeof fetch; fetchAgro?: typeof fetch; limitar?: boolean; clientDir?: string; fontesMalha?: FontesMalha } = {}) {
  const db = await criarDbTeste();
  await garantirAdmin(db, "admin@teste.com", "senha-forte-1");
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-up-"));
  const app = criarApp({ db, uploadsDir, segredo: "segredo-de-teste", producao: false, limitar: opts.limitar ?? false, hub: opts.hub, fetchIA: opts.fetchIA, fetchAgro: opts.fetchAgro, fontesMalha: opts.fontesMalha ?? malhaOffline, clientDir:opts.clientDir,siteUrl:"https://portal.teste.example" });
  const server = await new Promise<import("node:http").Server>((ok) => { const s = app.listen(0, "127.0.0.1", () => ok(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  /** Cliente HTTP com "jar" de cookie próprio (um por usuário simulado). */
  function cliente() {
    let cookie = "";
    const chamar = async (metodo: string, rota: string, corpo?: unknown, extra?: { form?: FormData }) => {
      const headers: Record<string, string> = {};
      if (metodo !== "GET") {
        const csrf = await chamar("GET", "/api/auth/csrf");
        headers["x-csrf-token"] = csrf.json.token;
      }
      if (cookie) headers.cookie = cookie;
      let body: any;
      if (extra?.form) body = extra.form;
      else if (corpo !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(corpo); }
      const r = await fetch(base + rota, { method: metodo, headers, body });
      const sc = r.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0];
      const texto = await r.text();
      let json: any = null; try { json = JSON.parse(texto); } catch { /* não é JSON */ }
      return { status: r.status, json, texto };
    };
    return {
      get: (r: string) => chamar("GET", r),
      post: (r: string, b?: unknown) => chamar("POST", r, b ?? {}),
      put: (r: string, b?: unknown) => chamar("PUT", r, b ?? {}),
      del: (r: string) => chamar("DELETE", r),
      upload: (r: string, buf: Buffer, nome = "foto.jpg", tipo = "image/jpeg", campos: Record<string, string> = {}) => {
        const form = new FormData();
        form.append("arquivo", new Blob([new Uint8Array(buf)], { type: tipo }), nome);
        for (const [k, v] of Object.entries(campos)) form.append(k, v);
        return chamar("POST", r, undefined, { form });
      },
    };
  }
  const admin = cliente();
  const login = await admin.post("/api/auth/entrar", { email: "admin@teste.com", senha: "senha-forte-1" });
  if (login.status !== 200) throw new Error("login admin falhou nos testes");
  return { db, base, uploadsDir, cliente, admin, fechar: () => new Promise<void>((ok) => server.close(() => ok())) };
}

/** JPEG sintético com EXIF contendo orientação 6 e "GPS" falso, mais XMP e comentário. */
export function jpegComExif(): Buffer {
  const seg = (marker: number, dados: Buffer) => { const h = Buffer.from([0xff, marker, 0, 0]); h.writeUInt16BE(dados.length + 2, 2); return Buffer.concat([h, dados]); };
  const tiff = Buffer.alloc(8 + 2 + 12 + 4); // MM, 1 entrada (Orientation=6)
  tiff.write("MM", 0, "latin1"); tiff.writeUInt16BE(0x2a, 2); tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8); tiff.writeUInt16BE(0x0112, 10); tiff.writeUInt16BE(3, 12); tiff.writeUInt32BE(1, 14); tiff.writeUInt16BE(6, 18);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff, Buffer.from("GPSLatitude-16.9234GPSLongitude-43.1234", "latin1")]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
    seg(0xe1, exif),
    seg(0xe1, Buffer.from("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>LOCALIZACAO-SECRETA</x:xmpmeta>", "latin1")),
    seg(0xfe, Buffer.from("comentario-com-endereco", "latin1")),
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0x56, 0xff, 0xd9]),
  ]);
}
