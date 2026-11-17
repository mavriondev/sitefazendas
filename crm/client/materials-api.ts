import type { MaterialLimits, MaterialItem, MaterialShare, MaterialsResponse, PublicMaterials } from "../materials-shared";
export type { MaterialLimits, MaterialItem, MaterialShare, MaterialsResponse, PublicMaterials };

const base = "/crm/api";
type Err = Error & { status?: number };
const fail = (message: string, status?: number): Err => Object.assign(new Error(message), { status });

let csrf = "";
async function token(force = false) {
  if (csrf && !force) return csrf;
  const r = await fetch(base + "/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!r.ok) throw fail(r.status === 401 ? "Sua sessão expirou. Entre de novo." : "Não foi possível preparar o envio.", r.status);
  csrf = ((await r.json()) as { token: string }).token;
  return csrf;
}
function expired(status: number) {
  if (status === 401) { csrf = ""; window.dispatchEvent(new Event("crm-expired")); }
  if (status === 403) csrf = "";
}
async function req<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["X-CSRF-Token"] = await token();
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let r: Response;
  try { r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", cache: "no-store" }); }
  catch { throw fail("Sem conexão. Verifique a internet e tente de novo."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { expired(r.status); throw fail(j.message || "Não foi possível concluir.", r.status); }
  return j as T;
}

export const materialsApi = {
  list: (farmId: number) => req<MaterialsResponse>(`/farms/${farmId}/materials`),
  downloadUrl: (farmId: number, key: string) => `${base}/farms/${farmId}/materials/download?key=${encodeURIComponent(key)}`,
  zipUrl: (farmId: number, keys: string[]) => `${base}/farms/${farmId}/materials/zip?keys=${encodeURIComponent(JSON.stringify(keys))}`,
  remove: (farmId: number, itemKey: string) => req<{ok:boolean;warning:string|null}>(`/farms/${farmId}/materials/${encodeURIComponent(itemKey.replace(/^m:/, ""))}`, "DELETE"),
  shares: (farmId: number) => req<{ links: MaterialShare[] }>(`/farms/${farmId}/material-shares`),
  createShare: (farmId: number, b: { keys: string[]; days: number; reviewed: true; request_key: string }) =>
    req<{ link: MaterialShare; path: string }>(`/farms/${farmId}/material-shares`, "POST", b),
  revokeShare: (farmId: number, shareId: number) => req<unknown>(`/farms/${farmId}/material-shares/${shareId}`, "DELETE"),
};

/** Dispara download nativo (sem carregar o arquivo na memória). */
export function nativeDownload(url: string) {
  const a = document.createElement("a");
  a.href = url; a.rel = "noopener"; a.download = "";
  document.body.appendChild(a); a.click(); a.remove();
}

export interface UploadHandle { promise: Promise<void>; abort: () => void }
/** Envio com progresso; requestKey estável por arquivo/tentativa evita registro duplicado. */
export function uploadMaterial(farmId: number, file: File, requestKey: string, onProgress: (p: number) => void): UploadHandle {
  let xhr: XMLHttpRequest | null = null;
  let aborted = false;
  const send = (tok: string, retry: boolean): Promise<void> => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); xhr = x;
    x.open("POST", `${base}/farms/${farmId}/materials`);
    x.withCredentials = true;
    x.setRequestHeader("X-CSRF-Token", tok);
    x.setRequestHeader("X-Request-Key", requestKey);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) { onProgress(1); resolve(); return; }
      let msg = "O envio não foi concluído.";
      try { const j = JSON.parse(x.responseText); if (j.message) msg = j.message; } catch { /* resposta não JSON */ }
      if (x.status === 413) msg = "Arquivo maior que o permitido pelo servidor.";
      if (x.status === 403 && !retry) { csrf = ""; token(true).then((t) => send(t, true)).then(resolve, reject); return; }
      expired(x.status);
      reject(fail(msg, x.status));
    };
    x.onerror = () => reject(fail("A conexão caiu durante o envio. Tente de novo; o arquivo não será duplicado."));
    x.onabort = () => reject(Object.assign(fail("Envio cancelado."), { status: 0, aborted: true }));
    const fd = new FormData(); fd.append("arquivo", file);
    x.send(fd);
  });
  const promise = token().then((t) => { if (aborted) throw Object.assign(fail("Envio cancelado."), { aborted: true }); return send(t, false); });
  return { promise, abort: () => { aborted = true; xhr?.abort(); } };
}

/* ---------- página externa (sem sessão) ---------- */
export type PublicErr = Error & { kind: "invalid" | "expired" | "unavailable" | "network" };
export async function fetchPublic(tok: string): Promise<PublicMaterials> {
  let r: Response;
  try { r = await fetch("/crm/shared-api/materials", { headers: { Authorization: `Bearer ${tok}` }, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" }); }
  catch { throw Object.assign(new Error("Sem conexão."), { kind: "network" as const }); }
  if (r.ok) return (await r.json()) as PublicMaterials;
  const kind = r.status === 410 ? "expired" : r.status === 401 || r.status === 403 || r.status === 404 ? "invalid" : "unavailable";
  throw Object.assign(new Error("indisponível"), { kind });
}
