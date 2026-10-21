import pg from "pg";

/** Interface mínima de banco: PostgreSQL em produção, PGlite nos testes. */
export interface Db {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

export function criarDbPg(connectionString: string): Db & { pool: pg.Pool } {
  const ssl = /sslmode=require|\.neon\.tech|\.supabase\.co/.test(connectionString) ? { rejectUnauthorized: false } : undefined;
  const pool = new pg.Pool({ connectionString, ssl, max: 10 });
  return {
    pool,
    async query(text, params) {
      const r = await pool.query(text, params as any[]);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    },
  };
}
