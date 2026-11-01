import { timingSafeEqual } from "node:crypto";
import { isDatabaseConfigured, withDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { loadHistory, restaurantTimeZone } from "@/lib/history";
import { buildPaydayEmail, isEmailConfigured, payrollRecipients, sendEmail } from "@/lib/email";
import { localToday, periodForPayday, upcomingPayday } from "@/lib/payroll";

/**
 * Runs every Thursday (see vercel.json): emails the owner who to pay on Friday.
 * Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isDatabaseConfigured() || !isEmailConfigured()) {
    return Response.json({ sent: false, reason: "Database or email isn't configured." });
  }

  const payday = upcomingPayday(localToday(await restaurantTimeZone()));
  // Claim this payday first, so a retried or doubled run can't send it twice.
  const claimed = await withDb((db) =>
    db.query("insert into email_log (kind, key) values ('payday', $1) on conflict do nothing", [payday]),
  );
  if (!claimed.rowCount) return Response.json({ sent: false, reason: `Already sent for ${payday}.` });

  try {
    const history = await loadHistory("payday", periodForPayday(payday).weekStart);
    await sendEmail({ to: payrollRecipients(), ...buildPaydayEmail(history) });
    await audit("system", "email.payday", { payday });
  } catch (err) {
    await withDb((db) => db.query("delete from email_log where kind = 'payday' and key = $1", [payday]));
    console.error("payday email failed", err);
    return Response.json({ sent: false, reason: "Sending failed; see logs." }, { status: 500 });
  }
  return Response.json({ sent: true, payday });
}
