"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendPayStubs } from "@/lib/stubs";
import { calculateCashOut } from "@/lib/cashout";
import { isDatabaseConfigured } from "@/lib/db";
import { PaidWeekError, deleteShift, markWeekPaid, saveShift, unmarkWeekPaid } from "@/lib/history";
import { isIsoDate } from "@/lib/payroll";
import { isManager, signIn, signOut } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { MAX_BOH, MIN_BOH, getBohShare } from "@/lib/staff";
import { withDb } from "@/lib/db";

export type SaveInput = {
  id: string;
  cash: number;
  card: number;
  staff: { name: string; hours: number }[];
  shiftDate: string;
  timeZone: string;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isMoney = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100_000;
const isHours = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 24;

function validZone(tz: unknown) {
  if (typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stores a cash-out in the shift history. Anyone on the calculator can save (that's the
 * iPad at close); only the manager can read or delete history. The server recalculates
 * from the raw inputs rather than trusting totals sent by the browser.
 */
export async function saveCashOutAction(input: SaveInput): Promise<SaveResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Shift history isn't set up yet." };

  const { id, cash, card, staff, shiftDate, timeZone } = input ?? {};
  const validStaff =
    Array.isArray(staff) &&
    staff.length > 0 &&
    staff.length <= 40 &&
    staff.every((s) => typeof s?.name === "string" && s.name.trim().length > 0 && s.name.length <= 40 && isHours(s.hours));
  if (
    typeof id !== "string" || !UUID.test(id) ||
    !isMoney(cash) || !isMoney(card) || cash + card <= 0 ||
    !validStaff ||
    typeof shiftDate !== "string" || !DATE.test(shiftDate) || Number.isNaN(Date.parse(shiftDate)) ||
    !validZone(timeZone)
  ) {
    return { ok: false, error: "That cash-out looks incomplete. Check the tips and hours." };
  }

  try {
    const result = calculateCashOut(
      cash,
      card,
      staff.map((s) => ({ name: s.name.trim(), hours: Math.round(s.hours * 100) / 100 })),
      new Date(),
      await getBohShare(),
    );
    await saveShift(id, result, shiftDate, timeZone);
  } catch (err) {
    if (err instanceof PaidWeekError) return { ok: false, error: "That week has already been paid, so it can't change. Ask the manager." };
    console.error("saveCashOut failed", err);
    return { ok: false, error: "Couldn't reach the database. Try again in a moment." };
  }
  revalidatePath("/history");
  return { ok: true };
}

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const pin = String(formData.get("pin") ?? "");
  if (!pin) return { error: "Enter the manager PIN." };
  const result = await signIn(pin);
  if (!result.ok) return { error: result.error };
  redirect("/history");
}

export async function logoutAction() {
  await signOut();
  redirect("/history");
}

export async function deleteShiftAction(formData: FormData) {
  if (!(await isManager())) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  try {
    await deleteShift(id);
  } catch (err) {
    if (!(err instanceof PaidWeekError)) throw err;
  }
  revalidatePath("/history");
}

/** Marks a pay week as paid, which locks its shifts. */
export async function markPaidAction(formData: FormData) {
  if (!(await isManager())) throw new Error("Unauthorized");
  const week = formData.get("week");
  if (!isIsoDate(week)) return;
  const newlyPaid = await markWeekPaid(week);
  // Pay stubs go out after the page has updated, so marking paid stays instant.
  if (newlyPaid) after(() => sendPayStubs(week).catch((err) => console.error("pay stubs failed", err)));
  revalidatePath("/history");
}

export async function unmarkPaidAction(formData: FormData) {
  if (!(await isManager())) throw new Error("Unauthorized");
  const week = formData.get("week");
  if (!isIsoDate(week)) return;
  await unmarkWeekPaid(week);
  revalidatePath("/history");
}

/** Sends stubs that haven't gone out yet for a paid week (say, after adding someone's email). */
export async function sendStubsAction(formData: FormData) {
  if (!(await isManager())) throw new Error("Unauthorized");
  const week = formData.get("week");
  if (!isIsoDate(week)) return;
  await sendPayStubs(week);
  revalidatePath("/history/log");
}

export type SettingsState = { ok?: string; error?: string };

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function contactFields(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  const phone = clean(formData.get("phone")).replace(/[^\d+]/g, "");
  if (email && (!EMAIL.test(email) || email.length > 120)) return { error: "That email doesn't look right." } as const;
  if (phone && (phone.replace(/\D/g, "").length < 10 || phone.length > 16)) return { error: "Use a full phone number, like 305 555 0123." } as const;
  return { email: email || null, phone: phone || null } as const;
}

/** Adds someone to the roster, or brings back an archived person with the same name. */
export async function addStaffAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  if (!(await isManager())) return { error: "Your session ended. Unlock History again." };
  const name = clean(formData.get("name")).replace(/\s+/g, " ");
  if (!name || name.length > 40) return { error: "Enter a name (40 characters max)." };
  const contact = contactFields(formData);
  if ("error" in contact) return { error: contact.error };
  await withDb((db) =>
    db.query(
      `insert into staff (name, email, phone) values ($1, $2, $3)
       on conflict (lower(trim(name))) do update set active = true,
         email = coalesce(excluded.email, staff.email), phone = coalesce(excluded.phone, staff.phone)`,
      [name, contact.email, contact.phone],
    ),
  );
  await audit("manager", "staff.added", { name, email: contact.email, phone: contact.phone });
  revalidatePath("/", "layout");
  return { ok: `${name} is on the roster.` };
}

export async function updateStaffAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  if (!(await isManager())) return { error: "Your session ended. Unlock History again." };
  const id = Number(formData.get("id"));
  const name = clean(formData.get("name")).replace(/\s+/g, " ");
  if (!Number.isInteger(id) || !name || name.length > 40) return { error: "Enter a name (40 characters max)." };
  const contact = contactFields(formData);
  if ("error" in contact) return { error: contact.error };
  try {
    const { rows } = await withDb((db) =>
      db.query<{ before: string }>(
        `update staff s set name = $2, email = $3, phone = $4 from staff old
         where s.id = $1 and old.id = s.id returning old.name as before`,
        [id, name, contact.email, contact.phone],
      ),
    );
    if (!rows.length) return { error: "That person no longer exists." };
    await audit("manager", "staff.updated", { id, name, previousName: rows[0].before, email: contact.email, phone: contact.phone });
  } catch {
    return { error: "Someone else on the roster already has that name." };
  }
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function setStaffActiveAction(formData: FormData) {
  if (!(await isManager())) throw new Error("Unauthorized");
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!Number.isInteger(id)) return;
  const { rows } = await withDb((db) => db.query<{ name: string }>("update staff set active = $2 where id = $1 returning name", [id, active]));
  if (rows.length) await audit("manager", active ? "staff.restored" : "staff.archived", { id, name: rows[0].name });
  revalidatePath("/", "layout");
}

export async function setBohShareAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  if (!(await isManager())) return { error: "Your session ended. Unlock History again." };
  const pct = Number(clean(formData.get("boh")));
  if (!Number.isFinite(pct) || pct < MIN_BOH * 100 || pct > MAX_BOH * 100) {
    return { error: `Enter a percentage between ${MIN_BOH * 100} and ${MAX_BOH * 100}.` };
  }
  const value = Math.round(pct * 10) / 1000;
  const previous = await getBohShare();
  if (value === previous) return { ok: "No change." };
  await withDb((db) =>
    db.query("insert into settings (key, value) values ('boh_share', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify(value)]),
  );
  await audit("manager", "settings.boh_share", { from: previous, to: value });
  revalidatePath("/", "layout");
  return { ok: `Kitchen share is now ${+(value * 100).toFixed(1)}%. It applies to new cash-outs; saved ones keep theirs.` };
}
