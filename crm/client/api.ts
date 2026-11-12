import type { User, Farm, Contact, Deal, Document, Event, Access, SourceStatus } from "../shared";
export type { User, Farm, Contact, Deal, Document, Event, Access, SourceStatus, Etapa } from "../shared";
export { ETAPAS, ROTULOS } from "../shared";
const base = "/crm/api";
let csrf = "";
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    if (!csrf) csrf = (await request<{ token: string }>("/csrf")).token;
    headers["X-CSRF-Token"] = csrf;
  }
  let data: BodyInit | undefined;
  if (body instanceof FormData) data = body;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; data = JSON.stringify(body); }
  const r = await fetch(base + path, { method, headers, body: data, credentials: "same-origin", cache: "no-store" });
  const j = await r.json().catch(() => ({ message: "Resposta inválida do servidor." }));
  if (!r.ok) {
    if (r.status === 401 && path !== "/login") { csrf = ""; window.dispatchEvent(new Event("crm-expired")); }
    if (r.status === 403) csrf = "";
    throw Object.assign(new Error(j.message || "Não foi possível concluir."), { status: r.status, duplicates: j.duplicates });
  }
  return j;
}
export const key = () => crypto.randomUUID();
export const api = {
  me: () => request<{ usuario: User | null }>("/me"),
  login: async (email: string, senha: string) => { const r = await request<{ usuario: User }>("/login", "POST", { email, senha }); csrf = ""; return r; },
  logout: async () => { await request("/logout", "POST", {}); csrf = ""; },
  password: (atual: string, nova: string) => request("/password", "PUT", { atual, nova }),
  users: () => request<{ usuarios: User[] }>("/users"),
  createUser: (b: { nome: string; email: string; senha: string; request_key: string }) => request<User>("/users", "POST", b),
  updateUser: (id: number, b: { bloqueado?: boolean; senha?: string; versao: number }) => request<User>(`/users/${id}`, "PUT", b),
  access: (id: number) => request<Access>(`/users/${id}/access`),
  saveAccess: (id: number, b: Access) => request(`/users/${id}/access`, "PUT", b),
  farms: () => request<{ fazendas: Farm[]; fonte: SourceStatus }>("/farms"),
  farm: (id: number) => request<{ fazenda: Farm; documentos: Document[]; negociacoes: Deal[]; historico: Event[]; site_url: string }>(`/farms/${id}`),
  refreshSource: () => request<{ fazendas: number }>("/source/refresh", "POST", {}),
  importContacts: () => request<{ importados: number; existentes: number }>("/source/import", "POST", {}),
  contacts: (q = "") => request<{ contatos: Contact[] }>("/contacts?q=" + encodeURIComponent(q)),
  contact: (id: number) => request<{ contato: Contact; negociacoes: Deal[]; historico: Event[] }>(`/contacts/${id}`),
  duplicates: (telefone: string, exclude?: number) => request<{ contatos: Array<{ id: number; nome: string }> }>("/contacts/duplicates?telefone=" + encodeURIComponent(telefone) + (exclude ? "&exclude=" + exclude : "")),
  saveContact: (id: number | null, b: { nome: string; telefone: string; email?: string | null; origem: string; observacoes: string; responsavel_id: number; fazenda_ids: number[]; versao?: number; request_key?: string; confirmar_duplicado?: boolean }) => request<Contact>(id ? `/contacts/${id}` : "/contacts", id ? "PUT" : "POST", b),
  deleteContact: (id: number, versao: number) => request(`/contacts/${id}`, "DELETE", { versao }),
  deals: () => request<{ negociacoes: Deal[] }>("/deals"),
  saveDeal: (id: number | null, b: { contato_id: number; fazenda_id: number; etapa: string; proximo_retorno: string | null; observacoes: string; versao?: number; request_key?: string }) => request<Deal>(id ? `/deals/${id}` : "/deals", id ? "PUT" : "POST", b),
  upload: (farmId: number, file: File, categoria: string, descricao: string, request_key: string) => {
    const f = new FormData(); f.append("categoria", categoria); f.append("descricao", descricao); f.append("request_key", request_key); f.append("arquivo", file);
    return request<Document>(`/farms/${farmId}/documents`, "POST", f);
  },
  deleteDocument: (id: number) => request(`/documents/${id}`, "DELETE", {}),
  downloadUrl: (id: number) => base + `/documents/${id}/download`,
  photoUrl: (farmId: number, arquivo: string) => base + `/farms/${farmId}/photos/${encodeURIComponent(arquivo)}`,
};
