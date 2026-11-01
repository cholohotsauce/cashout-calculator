import "server-only";
import type { PoolClient } from "pg";
import { clientIp } from "./auth";
import { withDb } from "./db";

export type Actor = "calculator" | "manager" | "system";

export type AuditEntry = { id: number; at: Date; actor: Actor; action: string; detail: Record<string, unknown> };

/** Records a change. Pass `db` to write inside the caller's transaction. */
export async function audit(actor: Actor, action: string, detail: Record<string, unknown> = {}, db?: PoolClient) {
  const ip = actor === "system" ? null : await clientIp().catch(() => null);
  const sql = "insert into audit_log (actor, action, detail, ip) values ($1, $2, $3, $4)";
  const params = [actor, action, JSON.stringify(detail), ip];
  if (db) await db.query(sql, params);
  else await withDb((c) => c.query(sql, params));
}

export async function recentAudit(limit = 200): Promise<AuditEntry[]> {
  const { rows } = await withDb((db) => db.query("select id, at, actor, action, detail from audit_log order by at desc, id desc limit $1", [limit]));
  return rows.map((r) => ({ id: Number(r.id), at: r.at, actor: r.actor, action: r.action, detail: r.detail }));
}
