import "server-only";
import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { SCHEMA_SQL } from "./schema";

/** True once a Postgres database (e.g. Neon from the Vercel Marketplace) is connected. */
export const isDatabaseConfigured = () => Boolean(process.env.DATABASE_URL);

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 5_000 });
    // Lets Vercel Fluid compute close idle connections before an instance is suspended.
    attachDatabasePool(pool);
  }
  return pool;
}

async function applySchema(client: PoolClient) {
  await client.query("begin");
  try {
    // Serialises first-boot migrations when several instances start at once.
    await client.query("select pg_advisory_xact_lock(hashtext('ace-cashout-schema'))");
    await client.query(SCHEMA_SQL);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}

/** Runs `fn` with a pooled connection, after making sure the tables exist. */
export async function withDb<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    schemaReady ??= applySchema(client).catch((err) => {
      schemaReady = null;
      throw err;
    });
    await schemaReady;
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Runs `fn` inside a transaction. */
export function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  return withDb(async (client) => {
    await client.query("begin");
    try {
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  });
}
