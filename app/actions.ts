"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { calculateCashOut } from "@/lib/cashout";
import { isDatabaseConfigured } from "@/lib/db";
import { deleteShift, saveShift } from "@/lib/history";
import { isManager, signIn, signOut } from "@/lib/auth";

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

  const result = calculateCashOut(
    cash,
    card,
    staff.map((s) => ({ name: s.name.trim(), hours: Math.round(s.hours * 100) / 100 })),
  );
  try {
    await saveShift(id, result, shiftDate, timeZone);
  } catch (err) {
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
  await deleteShift(id);
  revalidatePath("/history");
}
