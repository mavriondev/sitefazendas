import pg from "pg";
export interface QueryResult<T = any> { rows: T[]; rowCount: number }
export interface Query { query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>> }
export interface Database extends Query { transaction<T>(fn: (tx: Query) => Promise<T>): Promise<T> }
export function database(pool: pg.Pool): Database {
  const wrap = (p: pg.Pool | pg.PoolClient): Query => ({
    async query<T>(sql: string, params?: unknown[]) {
      const r = await p.query(sql, params); return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
  });
  return {
    ...wrap(pool),
    async transaction(fn) {
      const c = await pool.connect();
      try { await c.query("BEGIN"); const result = await fn(wrap(c)); await c.query("COMMIT"); return result; }
      catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
    },
  };
}
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS crm_users (
    id SERIAL PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL CHECK(papel IN ('admin','membro')), bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
    versao INTEGER NOT NULL DEFAULT 1, auth_version INTEGER NOT NULL DEFAULT 1,
    request_key UUID UNIQUE, criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS crm_farms (
    id INTEGER PRIMARY KEY, snapshot JSONB NOT NULL, disponivel BOOLEAN NOT NULL DEFAULT TRUE,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS crm_contacts (
    id SERIAL PRIMARY KEY, nome TEXT NOT NULL, telefone TEXT NOT NULL, email TEXT, origem TEXT NOT NULL,
    observacoes TEXT NOT NULL DEFAULT '', responsavel_id INTEGER NOT NULL REFERENCES crm_users(id),
    versao INTEGER NOT NULL DEFAULT 1, criado_por INTEGER NOT NULL REFERENCES crm_users(id),
    request_key UUID NOT NULL, source_kind TEXT, source_id INTEGER,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(criado_por,request_key), UNIQUE(source_kind,source_id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_phone_idx ON crm_contacts(telefone)`,
  `CREATE TABLE IF NOT EXISTS crm_contact_farms (
    contato_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    fazenda_id INTEGER NOT NULL REFERENCES crm_farms(id), PRIMARY KEY(contato_id,fazenda_id)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_farm_access (
    usuario_id INTEGER NOT NULL REFERENCES crm_users(id), fazenda_id INTEGER NOT NULL REFERENCES crm_farms(id),
    PRIMARY KEY(usuario_id,fazenda_id)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_contact_access (
    usuario_id INTEGER NOT NULL REFERENCES crm_users(id), contato_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    PRIMARY KEY(usuario_id,contato_id)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_deals (
    id SERIAL PRIMARY KEY, contato_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    fazenda_id INTEGER NOT NULL REFERENCES crm_farms(id), etapa TEXT NOT NULL
    CHECK(etapa IN ('novo','em_atendimento','visita_agendada','proposta','concluida','nao_avancou')),
    proximo_retorno TIMESTAMPTZ, observacoes TEXT NOT NULL DEFAULT '', versao INTEGER NOT NULL DEFAULT 1,
    criado_por INTEGER NOT NULL REFERENCES crm_users(id), request_key UUID NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(criado_por,request_key)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_documents (
    id SERIAL PRIMARY KEY, fazenda_id INTEGER NOT NULL REFERENCES crm_farms(id),
    arquivo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, mime TEXT NOT NULL, categoria TEXT NOT NULL,
    descricao TEXT NOT NULL DEFAULT '', tamanho INTEGER NOT NULL CHECK(tamanho>0 AND tamanho<=12582912),
    criado_por INTEGER NOT NULL REFERENCES crm_users(id), request_key UUID NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(criado_por,request_key)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_events (
    id SERIAL PRIMARY KEY, contato_id INTEGER, fazenda_id INTEGER, autor_id INTEGER NOT NULL REFERENCES crm_users(id),
    acao TEXT NOT NULL, detalhes JSONB NOT NULL DEFAULT '{}', criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS crm_source_status (
    id INTEGER PRIMARY KEY CHECK(id=1), atualizado_em TIMESTAMPTZ, erro BOOLEAN NOT NULL DEFAULT FALSE
  )`,
  `INSERT INTO crm_source_status(id) VALUES(1) ON CONFLICT DO NOTHING`,
];
export async function migrate(db: Query) { for (const sql of SCHEMA) await db.query(sql); }
