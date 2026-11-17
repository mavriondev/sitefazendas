import assert from "node:assert/strict";

interface Response { status: number; headers: Headers; buffer: Buffer; json: any }
/** Um cookie jar por sessão, usando os mesmos endpoints/CSRF das telas. */
export function client(base: string, prefix: string, csrfPath: string) {
  let cookie = "";
  async function request(method: string, route: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (!["GET", "HEAD"].includes(method)) {
      const csrf = await request("GET", csrfPath);
      assert.equal(csrf.status, 200);
      headers["x-csrf-token"] = csrf.json.token;
    }
    if (cookie) headers.cookie = cookie;
    let data: string | FormData | undefined;
    if (body instanceof FormData) data = body;
    else if (body !== undefined) { headers["content-type"] = "application/json"; data = JSON.stringify(body); }
    const res = await fetch(base + prefix + route, { method, headers, body: data, signal: AbortSignal.timeout(15000) });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const buffer = Buffer.from(await res.arrayBuffer());
    let json: any = null;
    try { json = JSON.parse(buffer.toString()); } catch { /* download binário */ }
    return { status: res.status, headers: res.headers, buffer, json };
  }
  return request;
}
