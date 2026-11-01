import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { formatMoney } from "@/lib/cashout";
import { isDatabaseConfigured } from "@/lib/db";
import { isManager } from "@/lib/auth";
import { recentAudit, type AuditEntry } from "@/lib/audit";
import { restaurantTimeZone } from "@/lib/history";
import { formatDay, formatRange, payPeriod } from "@/lib/payroll";
import { Panel, Shell } from "../ui";

export const metadata: Metadata = { title: "Change log · The Ace" };

const money = (c: unknown) => formatMoney(Number(c) / 100);
const day = (d: unknown) => formatDay(String(d));

type Tone = "neutral" | "good" | "warn" | "bad";

/** Turns a log entry into one plain sentence. */
function describe(e: AuditEntry): { text: string; tone: Tone } {
  const d = e.detail;
  switch (e.action) {
    case "shift.saved":
      return { text: `Cash-out saved for ${day(d.shiftDate)}: ${money(d.totalCents)} to ${(d.staff as unknown[])?.length ?? 0} people`, tone: "good" };
    case "shift.updated": {
      const moved = d.previousShiftDate && d.previousShiftDate !== d.shiftDate ? ` (moved from ${day(d.previousShiftDate)})` : "";
      const changed = d.previousTotalCents !== d.totalCents ? `, total ${money(d.previousTotalCents)} → ${money(d.totalCents)}` : ", same total";
      return { text: `Cash-out for ${day(d.shiftDate)} corrected${moved}${changed}`, tone: "warn" };
    }
    case "shift.deleted":
      return { text: `Cash-out for ${day(d.shiftDate)} deleted (${money(d.totalCents)}; ${(d.staff as string[])?.join(", ")})`, tone: "bad" };
    case "week.paid": {
      const p = payPeriod(String(d.weekStart));
      return { text: `Week ${formatRange(p.weekStart, p.weekEnd)} marked paid (${money(d.totalCents)} in tips)`, tone: "good" };
    }
    case "week.unlocked": {
      const p = payPeriod(String(d.weekStart));
      return { text: `Week ${formatRange(p.weekStart, p.weekEnd)} unlocked after being paid`, tone: "bad" };
    }
    case "staff.added":
      return { text: `${d.name} added to the roster`, tone: "neutral" };
    case "staff.updated":
      return { text: d.previousName !== d.name ? `${d.previousName} renamed to ${d.name}` : `${d.name}'s contact details updated`, tone: "neutral" };
    case "staff.archived":
      return { text: `${d.name} removed from the calculator`, tone: "neutral" };
    case "staff.restored":
      return { text: `${d.name} brought back to the calculator`, tone: "neutral" };
    case "settings.boh_share":
      return { text: `Kitchen share changed from ${+(Number(d.from) * 100).toFixed(1)}% to ${+(Number(d.to) * 100).toFixed(1)}%`, tone: "warn" };
    case "manager.signed_in":
      return { text: "Manager unlocked History", tone: "neutral" };
    case "email.payday":
      return { text: `Payday email sent for ${day(d.payday)}`, tone: "neutral" };
    case "email.stubs":
      return { text: `Pay stubs emailed to ${d.count} people`, tone: "neutral" };
    default:
      return { text: e.action, tone: "neutral" };
  }
}

const DOT: Record<Tone, string> = {
  neutral: "bg-white/30",
  good: "bg-emerald-400",
  warn: "bg-amber-300",
  bad: "bg-rose-400",
};

export default async function LogPage() {
  await connection();
  if (!isDatabaseConfigured() || !(await isManager())) redirect("/history");
  const [entries, timeZone] = await Promise.all([recentAudit(300), restaurantTimeZone()]);

  // Group by local calendar day, newest first.
  const groups = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    const key = e.at.toLocaleDateString("en-CA", { timeZone });
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <Shell signedIn section="log" title="Change log">
      <Panel>
        <p className="text-sm text-white/55">
          Every save, correction, delete and payment, as it happened. Entries can&apos;t be edited or removed from the app.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
          {(
            [
              ["good", "Saved / paid"],
              ["warn", "Corrected"],
              ["bad", "Deleted / unlocked"],
            ] as const
          ).map(([tone, label]) => (
            <span key={tone} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} />
              {label}
            </span>
          ))}
        </div>
      </Panel>

      {entries.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-white/50">Nothing has changed yet.</p>
        </Panel>
      ) : (
        [...groups].map(([date, items]) => (
          <Panel key={date} title={formatDay(date, { weekday: "long", month: "long", day: "numeric" })}>
            <ol className="space-y-3">
              {items.map((e) => {
                const { text, tone } = describe(e);
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] text-white/90">{text}</p>
                      <p className="text-xs text-white/40">
                        {e.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })} ·{" "}
                        {e.actor === "calculator" ? "from the calculator" : e.actor === "manager" ? "by a manager" : "automatic"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        ))
      )}
    </Shell>
  );
}
