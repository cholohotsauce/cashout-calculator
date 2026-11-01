import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { withDb } from "./db";
import { audit } from "./audit";

const COOKIE = "ace_manager";
const SESSION_DAYS = 7;
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

export const isPinConfigured = () => Boolean(process.env.MANAGER_PIN);

/** The signing key changes with the PIN, so changing MANAGER_PIN signs everyone out. */
function signingKey() {
  const secret = process.env.SESSION_SECRET ?? process.env.DATABASE_URL ?? "";
  return createHash("sha256").update(`ace-session:${secret}:${process.env.MANAGER_PIN ?? ""}`).digest();
}

const sign = (payload: string) => createHmac("sha256", signingKey()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Whether this request carries a valid, unexpired manager session. */
export async function isManager() {
  if (!isPinConfigured()) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return safeEqual(signature, sign(`manager:${expires}`));
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Checks the PIN, locking an IP out for a while after repeated wrong guesses. */
export async function signIn(pin: string): Promise<LoginResult> {
  const expected = process.env.MANAGER_PIN;
  if (!expected) return { ok: false, error: "No manager PIN has been set up yet." };

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

  // Compare digests so the check takes the same time whatever the PIN's length.
  const digest = (v: string) => createHash("sha256").update(v).digest("hex");
  if (!safeEqual(digest(pin.trim()), digest(expected))) {
    await withDb(async (db) => {
      await db.query("insert into login_attempts (ip) values ($1)", [ip]);
      await db.query("delete from login_attempts where attempted_at < now() - interval '1 day'");
    });
    const left = MAX_FAILURES - failures - 1;
    return { ok: false, error: left > 0 ? `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.` : `Wrong PIN. Locked for ${LOCKOUT_MINUTES} minutes.` };
  }

  await withDb((db) => db.query("delete from login_attempts where ip = $1", [ip]));
  await audit("manager", "manager.signed_in");
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  (await cookies()).set(COOKIE, `${expires}.${sign(`manager:${expires}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
  return { ok: true };
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
