import type pg from "pg";
import type { Query, Database } from "./db";
import { check, event } from "./security";
import type { User } from "../shared";
import crypto from "node:crypto";
export interface SourceSnapshot { farms: any[]; contacts: any[]; presentations: any[] }
export interface Source { read(): Promise<SourceSnapshot> }
export class PgSource implements Source {
  constructor(private pool: pg.Pool) {}
  async read(): Promise<SourceSnapshot> {
    const c = await this.pool.connect();
    try {
      // O adaptador não possui método de escrita nem executa migrações.
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const rights = await c.query(`SELECT bool_or(has_table_privilege(current_user,t,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')) AS escrita
        FROM unnest(ARRAY['fazendas','fazenda_atributos','fazenda_fotos','contatos','apresentacoes']) t`);
      check(rights.rows[0]?.escrita === false, 503, "A credencial de origem deve ser exclusivamente de leitura.");
      const farms = (await c.query(`SELECT id,titulo,slug,status,regiao_publica,area_ha,descricao_publica,culturas,preco_exibicao,
        car_codigo,municipio,uf,notas_internas,atualizado_em FROM fazendas ORDER BY id`)).rows;
      const attrs = (await c.query("SELECT fazenda_id,chave,estado,achado,valor_json,fonte,observacao,publico,origem FROM fazenda_atributos ORDER BY fazenda_id,chave")).rows;
      const photos = (await c.query("SELECT fazenda_id,arquivo,legenda FROM fazenda_fotos ORDER BY fazenda_id,capa DESC,ordem,id")).rows;
      const contacts = (await c.query("SELECT id,nome,whatsapp,email,mensagem,origem,fazenda_id,criado_em FROM contatos ORDER BY id")).rows;
      const presentations = (await c.query("SELECT id,comprador_nome,comprador_contato,canal,observacao,fazenda_id,apresentado_em FROM apresentacoes ORDER BY id")).rows;
      await c.query("COMMIT");
      return { farms: farms.map(f => ({ ...f, atributos: attrs.filter(a => a.fazenda_id === f.id), fotos: photos.filter(p => p.fazenda_id === f.id) })), contacts, presentations };
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  }
}
export async function readSource(db: Query, source?: Source) {
  try {
    check(source, 503, "Fonte do site não configurada.");
    const data = await source.read();
    check(data && Array.isArray(data.farms) && Array.isArray(data.contacts) && Array.isArray(data.presentations), 503);
    check(data.farms.every(f => Number.isSafeInteger(f.id) && f.id > 0 && typeof f.titulo === "string" && typeof f.slug === "string"), 503);
    check(data.contacts.every(c => Number.isSafeInteger(c.id) && c.id > 0 && typeof c.nome === "string"), 503);
    check(data.presentations.every(p => Number.isSafeInteger(p.id) && p.id > 0 && typeof p.comprador_nome === "string"), 503);
    return data;
  }
  catch {
    await db.query("UPDATE crm_source_status SET erro=TRUE WHERE id=1");
    throw Object.assign(new Error("A origem do site está indisponível. Os registros anteriores foram preservados."), { status: 503 });
  }
}
export async function refresh(db: Database, source: Source | undefined, user: User) {
  const s = await readSource(db, source);
  check(Array.isArray(s.farms) && s.farms.every(f => Number.isSafeInteger(f.id) && f.id > 0 && typeof f.titulo === "string"), 503, "Resposta inválida da origem.");
  await db.transaction(async tx => {
    for (const f of s.farms) {
      await tx.query(`INSERT INTO crm_farms(id,snapshot) VALUES($1,$2::jsonb)
        ON CONFLICT(id) DO UPDATE SET snapshot=EXCLUDED.snapshot,disponivel=TRUE,atualizado_em=now()`, [f.id, JSON.stringify(f)]);
    }
    await tx.query("UPDATE crm_farms SET disponivel=FALSE WHERE NOT(id=ANY($1::int[]))", [s.farms.map(f => f.id)]);
    await tx.query("UPDATE crm_source_status SET atualizado_em=now(),erro=FALSE WHERE id=1");
    await event(tx, user, "Dados do site atualizados", { quantidade: s.farms.length });
  });
  return { fazendas: s.farms.length };
}
export async function importContacts(db: Database, source: Source | undefined, user: User) {
  const s = await readSource(db, source);
  return db.transaction(async tx => {
    let importados = 0, existentes = 0;
    const rows = [
      ...s.contacts.map(c => ({ kind: "contato", id: c.id, nome: c.nome, telefone: c.whatsapp, email: c.email, obs: c.mensagem, origem: c.origem, fazenda: c.fazenda_id })),
      ...s.presentations.map(p => ({ kind: "apresentacao", id: p.id, nome: p.comprador_nome, telefone: p.comprador_contato, email: null, obs: [p.observacao, p.comprador_contato, p.canal, p.apresentado_em].filter(Boolean).join("\n"), origem: "Apresentação do site", fazenda: p.fazenda_id })),
    ];
    for (const r of rows) {
      const tel = String(r.telefone ?? "").replace(/\D/g, "");
      const inserted = await tx.query(`INSERT INTO crm_contacts(nome,telefone,email,origem,observacoes,responsavel_id,criado_por,request_key,source_kind,source_id)
        VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9) ON CONFLICT(source_kind,source_id) DO NOTHING RETURNING id`,
      [String(r.nome).slice(0, 150), tel.length >= 10 && tel.length <= 15 ? tel : "", r.email || null, String(r.origem || "Site").slice(0, 100), String(r.obs || "").slice(0, 4000), user.id, crypto.randomUUID(), r.kind, r.id]);
      if (!inserted.rowCount) { existentes++; continue; }
      const cid = inserted.rows[0].id; importados++;
      if (r.fazenda && (await tx.query("SELECT 1 FROM crm_farms WHERE id=$1", [r.fazenda])).rowCount)
        await tx.query("INSERT INTO crm_contact_farms(contato_id,fazenda_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [cid, r.fazenda]);
      await event(tx, user, "Contato importado", { origem: r.kind, identificador: r.id }, cid);
    }
    await event(tx, user, "Importação concluída", { importados, existentes });
    return { importados, existentes };
  });
}
