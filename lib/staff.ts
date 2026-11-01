import "server-only";
import { BOH_SHARE } from "./cashout";
import { isDatabaseConfigured, withDb } from "./db";

/** The roster the calculator shipped with; used to seed the staff table the first time. */
export const DEFAULT_ROSTER = ["Archie", "Asa", "Chloe", "Daniel", "Devon", "Karyn", "Liam", "Nat", "Wes"];

export type StaffMember = { id: number; name: string; email: string | null; phone: string | null; active: boolean };

export const MIN_BOH = 0;
export const MAX_BOH = 0.6;

async function seedIfEmpty() {
  await withDb(async (db) => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from staff");
    if (rows[0].n > 0) return;
    await db.query("insert into staff (name) select unnest($1::text[]) on conflict do nothing", [DEFAULT_ROSTER]);
  });
}

export async function listStaff(): Promise<StaffMember[]> {
  await seedIfEmpty();
  const { rows } = await withDb((db) =>
    db.query<StaffMember>("select id, name, email, phone, active from staff order by active desc, lower(name)"),
  );
  return rows;
}

export async function getBohShare() {
  const { rows } = await withDb((db) => db.query<{ value: number }>("select value from settings where key = 'boh_share'"));
  const v = Number(rows[0]?.value);
  return Number.isFinite(v) && v >= MIN_BOH && v <= MAX_BOH ? v : BOH_SHARE;
}

/**
 * What the calculator needs on load. If the database is missing or down, it falls back to the
 * built-in roster and 30%, so the calculator always works at close.
 */
export async function calculatorConfig(): Promise<{ staff: string[]; bohShare: number; live: boolean }> {
  if (!isDatabaseConfigured()) return { staff: DEFAULT_ROSTER, bohShare: BOH_SHARE, live: false };
  try {
    const [staff, bohShare] = await Promise.all([listStaff(), getBohShare()]);
    return { staff: staff.filter((s) => s.active).map((s) => s.name), bohShare, live: true };
  } catch (err) {
    console.error("calculatorConfig fell back to defaults", err);
    return { staff: DEFAULT_ROSTER, bohShare: BOH_SHARE, live: false };
  }
}
