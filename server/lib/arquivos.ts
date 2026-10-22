import fs from "node:fs/promises";
import path from "node:path";
import { ObjectNotFoundError, ObjectStorageService, objectStorageClient } from "./objectStorage";

const storage = new ObjectStorageService();

export function armazenamentoPersistenteAtivo(): boolean {
  return process.env.NODE_ENV !== "test" && Boolean(process.env.PRIVATE_OBJECT_DIR);
}

export function arquivoInexistente(erro: unknown): boolean {
  const e = erro as { code?: number | string; status?: number; name?: string; message?: string };
  return erro instanceof ObjectNotFoundError
    || e?.name === "ObjectNotFoundError"
    || Number(e?.code) === 404
    || Number(e?.status) === 404
    || /^No such object:/i.test(e?.message ?? "");
}

function nomeValido(nome: string): boolean {
  return /^[a-f0-9]{32}\.(jpg|png)$/.test(nome);
}

function prefixoUploads(): string {
  const prefixo = (process.env.UPLOADS_DIR || "sitefazendas/uploads")
    .replace(/^\/+|\/+$/g, "");
  if (!prefixo || prefixo.split("/").some((parte) => !/^[a-zA-Z0-9_-]+$/.test(parte))) {
    throw new Error("UPLOADS_DIR precisa ser um prefixo válido dentro do App Storage.");
  }
  return prefixo;
}

function arquivoNoBucket(nome: string) {
  if (!nomeValido(nome)) throw new Error("Nome de arquivo inválido.");
  const destino = `${storage.getPrivateObjectDir()}/${prefixoUploads()}/${nome}`.replace(/^\/+/, "");
  const [bucket, ...partes] = destino.split("/");
  if (!bucket || partes.length === 0) throw new Error("PRIVATE_OBJECT_DIR inválido.");
  return objectStorageClient.bucket(bucket).file(partes.join("/"));
}

export async function salvarArquivo(
  uploadsDir: string,
  nome: string,
  conteudo: Buffer,
  contentType: "image/jpeg" | "image/png",
): Promise<void> {
  if (!nomeValido(nome)) throw new Error("Nome de arquivo inválido.");
  if (armazenamentoPersistenteAtivo()) {
    await arquivoNoBucket(nome).save(conteudo, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "private, no-store",
      },
    });
    return;
  }
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, nome), conteudo);
}

export async function apagarArquivo(uploadsDir: string, nome: string | null): Promise<void> {
  if (!nome || !nomeValido(nome)) return;
  if (armazenamentoPersistenteAtivo()) {
    try {
      await arquivoNoBucket(nome).delete({ ignoreNotFound: true });
    } catch (erro) {
      console.error("[storage] Não foi possível remover imagem:", erro);
    }
    return;
  }
  await fs.unlink(path.join(uploadsDir, nome)).catch(() => {});
}

export async function buscarArquivo(nome: string) {
  if (!nomeValido(nome)) return null;
  try {
    return await storage.getObjectEntityFile(`/objects/${prefixoUploads()}/${nome}`);
  } catch (erro) {
    if (arquivoInexistente(erro)) return null;
    throw erro;
  }
}
