import fs from "node:fs/promises";
import path from "node:path";

// Fotos em disco local (UPLOADS_DIR). Os nomes são aleatórios (32 hex) e só este módulo toca no disco.
function nomeValido(nome: string): boolean {
  return /^[a-f0-9]{32}\.(jpg|png)$/.test(nome);
}

export async function salvarArquivo(uploadsDir: string, nome: string, conteudo: Buffer): Promise<void> {
  if (!nomeValido(nome)) throw new Error("Nome de arquivo inválido.");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, nome), conteudo);
}

export async function apagarArquivo(uploadsDir: string, nome: string | null): Promise<void> {
  if (!nome || !nomeValido(nome)) return;
  await fs.unlink(path.join(uploadsDir, nome)).catch(() => {});
}

export const caminhoDoArquivo = (uploadsDir: string, nome: string): string | null =>
  nomeValido(nome) ? path.resolve(uploadsDir, nome) : null;
