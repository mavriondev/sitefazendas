import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { sanitizarImagem } from "./foto";
import { NOME_ARQUIVO_DOCUMENTO } from "../../shared/documentos";

// Documentos ficam em pasta PRIVADA (DOCUMENTOS_DIR), separada de UPLOADS_DIR (fotos públicas).
// Nenhuma rota pública lê esta pasta; só o painel (administrador) e o CRM (somente leitura).

export type Inspecao = { ok: true; dados: Buffer; ext: ".pdf" | ".jpg" | ".png"; mime: string } | { ok: false; erro: string };

export function inspecionarDocumento(buf: Buffer, nomeOriginal: string): Inspecao {
  const ext = path.extname(nomeOriginal).toLowerCase();
  if ([".png", ".jpg", ".jpeg"].includes(ext)) {
    const limpa = sanitizarImagem(buf);
    if (!limpa) return { ok: false, erro: "Imagem inválida. Envie JPEG ou PNG." };
    return { ok: true, dados: limpa.dados, ext: limpa.tipo === "jpeg" ? ".jpg" : ".png", mime: limpa.tipo === "jpeg" ? "image/jpeg" : "image/png" };
  }
  const valido = ext === ".pdf" && /^%PDF-1\.[0-7]/.test(buf.subarray(0, 16).toString("latin1")) && /%%EOF\s*$/.test(buf.subarray(-1024).toString("latin1"));
  if (!valido) return { ok: false, erro: "Envie PDF, JPEG ou PNG válido." };
  const tokens = buf.toString("latin1").replace(/#([0-9a-f]{2})/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  if (/\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|Filespec|XFA|RichMedia|AcroForm|ObjStm|Encrypt|GoToR|SubmitForm|ImportData)\b/i.test(tokens))
    return { ok: false, erro: "PDF com recursos ativos, anexos ou criptografia não é aceito. Exporte uma cópia simples." };
  return { ok: true, dados: buf, ext: ".pdf", mime: "application/pdf" };
}

/** O multipart chega em latin1: reconverte para UTF-8 (acentos) quando o resultado é válido. */
export function nomeDoUpload(nome: string) {
  const u = Buffer.from(nome, "latin1").toString("utf8");
  return u.includes("\uFFFD") ? nome : u;
}

export function nomeSeguro(nome: string, ext: string) {
  const base = path.basename(nome.replace(/\\/g, "/"), path.extname(nome)).normalize("NFKC").replace(/[^a-zA-Z0-9À-ÿ _.-]/g, "").slice(0, 110).replace(/^\.+/, "").trim();
  return (base || "Documento") + ext;
}

export const novoNomeArquivo = (ext: string) => crypto.randomBytes(24).toString("hex") + ext;
export const caminhoDocumento = (dir: string, arquivo: string): string | null => (NOME_ARQUIVO_DOCUMENTO.test(arquivo) ? path.resolve(dir, arquivo) : null);

export async function salvarDocumento(dir: string, arquivo: string, dados: Buffer) {
  const destino = caminhoDocumento(dir, arquivo); if (!destino) throw new Error("Nome de arquivo inválido.");
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  // O grupo privado da pasta pode ler pelo ponto de montagem somente leitura do CRM.
  // A pasta permanece fora dos uploads públicos; nenhum acesso é dado a outros usuários.
  await fs.writeFile(destino, dados, { flag: "wx", mode: 0o640 });
  await fs.chmod(destino, 0o640); // A UMask restritiva do serviço não deve bloquear a leitura do CRM.
}
export async function apagarDocumento(dir: string, arquivo: string | null) {
  const destino = arquivo ? caminhoDocumento(dir, arquivo) : null;
  if (destino) await fs.unlink(destino).catch(() => {});
}
