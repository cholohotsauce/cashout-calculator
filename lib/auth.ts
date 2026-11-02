import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { withDb } from "./db";
import { audit } from "./audit";

const COOKIE = "ace_manager";
const SESSION_DAYS = 7;
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

export type Manager = { name: string; pin: string };

/**
 * Managers and their PINs. MANAGER_PINS lists each person as "Name:PIN", separated by commas
 * (e.g. "Archie:1111,Rafa:2222,Asa:3333"), so the change log can say who did what.
 * A lone MANAGER_PIN still works and signs in as "Manager".
 */
export function managers(): Manager[] {
  const list = (process.env.MANAGER_PINS ?? "")
    .split(",")
    .map((entry) => {
      const i = entry.lastIndexOf(":");
      return { name: entry.slice(0, i).trim(), pin: entry.slice(i + 1).trim() };
    })
    .filter((m) => m.name && m.pin);
  if (list.length) return list;
  return process.env.MANAGER_PIN ? [{ name: "Manager", pin: process.env.MANAGER_PIN.trim() }] : [];
}

export const isPinConfigured = () => managers().length > 0;

function signingKey() {
  const secret = process.env.SESSION_SECRET ?? process.env.DATABASE_URL ?? "";
  return createHash("sha256").update(`ace-session:${secret}`).digest();
}

const digest = (v: string) => createHash("sha256").update(v).digest("hex");

// Each session is tied to that person's current PIN, so changing or removing someone's PIN
// signs only them out.
const sign = (expires: string, m: Manager) =>
  createHmac("sha256", signingKey()).update(`manager:${expires}:${m.name}:${digest(m.pin)}`).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The manager this request is signed in as, or null. */
export async function currentManager(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [expires, encodedName, signature] = token.split(".");
  if (!expires || !encodedName || !signature || Number(expires) < Date.now()) return null;
  const name = Buffer.from(encodedName, "base64url").toString();
  const m = managers().find((x) => x.name === name);
  return m && safeEqual(signature, sign(expires, m)) ? m.name : null;
}

/** Whether this request carries a valid, unexpired manager session. */
export async function isManager() {
  return (await currentManager()) !== null;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Checks the PIN, locking an IP out for a while after repeated wrong guesses. */
export async function signIn(pin: string): Promise<LoginResult> {
  const all = managers();
  if (!all.length) return { ok: false, error: "No manager PIN has been set up yet." };

  const ip = await clientIp();
  const failures = await withDb(async (db) => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from login_attempts where ip = $1 and attempted_at > now() - make_interval(mins => $2)`,
      [ip, LOCKOUT_MINUTES],
    );
    return rows[0].n;
  });
  if (failures >= MAX_FAILURES) {
    return { ok: false, error: `Too many wrong PINs. Try again in ${LOCKOUT_MINUTES} minutes.` };
  }

  // Compare digests against every PIN so the check takes the same time whoever matches.
  const given = digest(pin.trim());
  const matches = all.filter((m) => safeEqual(given, digest(m.pin)));
  if (matches.length > 1) return { ok: false, error: "Two managers share that PIN. Give each person their own." };
  const who = matches[0];
  if (!who) {
    await withDb(async (db) => {
      await db.query("insert into login_attempts (ip) values ($1)", [ip]);
      await db.query("delete from login_attempts where attempted_at < now() - interval '1 day'");
    });
    const left = MAX_FAILURES - failures - 1;
    return { ok: false, error: left > 0 ? `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.` : `Wrong PIN. Locked for ${LOCKOUT_MINUTES} minutes.` };
  }

  await withDb((db) => db.query("delete from login_attempts where ip = $1", [ip]));
  await audit("manager", "manager.signed_in", { by: who.name });
  const expires = String(Date.now() + SESSION_DAYS * 86_400_000);
  (await cookies()).set(COOKIE, `${expires}.${Buffer.from(who.name).toString("base64url")}.${sign(expires, who)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Number(expires)),
  });
  return { ok: true };
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
