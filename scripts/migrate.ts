// Applies the database schema by hand: `npm run db:migrate` (reads DATABASE_URL, e.g. from .env.local).
// The app also applies it automatically before its first query, so this is optional.
import pg from "pg";
import { SCHEMA_SQL } from "../lib/schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(SCHEMA_SQL);
  console.log("Schema is up to date.");
} finally {
  await client.end();
}
