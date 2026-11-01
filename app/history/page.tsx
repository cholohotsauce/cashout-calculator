import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { formatHours, formatMoney } from "@/lib/cashout";
import { isDatabaseConfigured } from "@/lib/db";
import { isManager, isPinConfigured } from "@/lib/auth";
import { RANGES, isRangeKey, loadHistory, type PeriodStatus, type RangeKey, type SavedShift } from "@/lib/history";
import { addDays, formatDay, formatRange, mondayOf } from "@/lib/payroll";
import { markPaidAction, unmarkPaidAction, sendStubsAction } from "../actions";
import { Panel, Shell } from "./ui";
import { ConfirmAction } from "./ConfirmAction";
import { PinForm } from "./PinForm";
import { DeleteShiftButton } from "./DeleteShiftButton";

export const metadata: Metadata = { title: "Shift history · The Ace" };

const cents = (c: number) => formatMoney(c / 100);

function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <Shell>
      <Panel title="Shift history isn't switched on yet">
        <p className="text-white/65">
          The calculator works as usual. To keep a history of cash-outs, the site owner needs to add{" "}
          {missing.map((m, i) => (
            <span key={m}>
              {i > 0 && " and "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-copper-light">{m}</code>
            </span>
          ))}{" "}
          in the Vercel project settings.
        </p>
      </Panel>
    </Shell>
  );
}

function shiftTime(s: SavedShift) {
  return s.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: s.timeZone });
}

function shiftDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function rangeLabel(from: string | null, to: string | null) {
  if (!from || !to) return "Every saved shift";
  const opts = { month: "short", day: "numeric", timeZone: "UTC" } as const;
  const f = new Date(`${from}T12:00:00Z`).toLocaleDateString("en-US", opts);
  const t = new Date(`${to}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${f} – ${t}`;
}

function PaydayCard({ period }: { period: PeriodStatus }) {
  const nav = (weekStart: string, label: string, d: string) => (
    <Link
      href={`/history?range=payday&week=${weekStart}`}
      aria-label={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
    >
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d={d} clipRule="evenodd" />
      </svg>
    </Link>
  );
  return (
    <section className="rounded-[28px] border border-copper/30 bg-gradient-to-b from-copper/[0.14] to-white/[0.04] p-5 shadow-xl backdrop-blur-3xl sm:p-6">
      <div className="flex items-center gap-3">
        {nav(addDays(period.weekStart, -7), "Previous payday", "M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z")}
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-copper-light">
            {period.isCurrent ? "This Friday's payday" : "Payday"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">{formatDay(period.payday, { weekday: "long", month: "long", day: "numeric" })}</h2>
          <p className="mt-1 text-sm text-white/55">Tips earned {formatRange(period.weekStart, period.weekEnd)}</p>
        </div>
        {nav(addDays(period.weekStart, 7), "Next payday", "M7.3 15.7a1 1 0 010-1.4l4.3-4.3-4.3-4.3a1 1 0 011.4-1.4l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4 0z")}
      </div>

      {period.missing.length > 0 && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M8.3 3.1a2 2 0 013.4 0l6.1 10.6A2 2 0 0116.1 17H3.9a2 2 0 01-1.7-3.3L8.3 3.1zM10 7a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <p>
            No cash-out saved for <strong>{period.missing.map((d) => formatDay(d)).join(", ")}</strong>. If you were open, those tips aren&apos;t counted yet.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        {period.paid ? (
          <>
            <span className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Paid · locked {period.paid.paidAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <ConfirmAction action={unmarkPaidAction} fields={{ week: period.weekStart }} label="Undo" confirmLabel="Unlock this week" pendingLabel="Unlocking…" />
            <ConfirmAction action={sendStubsAction} fields={{ week: period.weekStart }} label="Email pay stubs" confirmLabel="Send to anyone not sent yet" pendingLabel="Sending…" />
          </>
        ) : (
          <ConfirmAction
            action={markPaidAction}
            fields={{ week: period.weekStart }}
            label="Mark week as paid"
            confirmLabel="Confirm: tips paid out"
            pendingLabel="Saving…"
            tone="primary"
          />
        )}
        <Link href={`/history/email?week=${period.weekStart}`} className="rounded-full px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
          Preview Thursday email
        </Link>
      </div>
    </section>
  );
}

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  // Always render per request: the setup state comes from env vars and history is private.
  await connection();
  const missing = [!isDatabaseConfigured() && "a Postgres database", !isPinConfigured() && "a MANAGER_PIN"].filter(Boolean) as string[];
  if (missing.length) return <SetupNotice missing={missing} />;

  if (!(await isManager())) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm pt-8">
          <Panel>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-copper/15 ring-1 ring-copper/40">
                <svg className="h-5 w-5 text-copper-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-white/90">Managers only</h2>
              <p className="mt-1 text-sm text-white/50">Enter the PIN to see past cash-outs.</p>
            </div>
            <PinForm />
          </Panel>
        </div>
      </Shell>
    );
  }

  const params = await searchParams;
  const range: RangeKey = isRangeKey(params.range) ? params.range : "payday";
  const week = typeof params.week === "string" ? params.week : undefined;
  const { from, to, shifts, staffTotals, totals, period, paidWeeks } = await loadHistory(range, week);
  const exportHref = `/history/export?range=${range}${period ? `&week=${period.weekStart}` : ""}`;

  return (
    <Shell signedIn section="history">
      <nav className="flex gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-white/[0.05] p-1.5 backdrop-blur-3xl" aria-label="Date range">
        {(Object.keys(RANGES) as RangeKey[]).map((key) => (
          <Link
            key={key}
            href={key === "payday" ? "/history" : `/history?range=${key}`}
            aria-current={key === range ? "page" : undefined}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-center text-sm font-medium transition-colors ${
              key === range ? "bg-white/90 text-black" : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {RANGES[key]}
          </Link>
        ))}
      </nav>

      {period && <PaydayCard period={period} />}

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-white/50">{period ? "Totals for this pay week" : rangeLabel(from, to)}</p>
        {shifts.length > 0 && (
          <a
            href={exportHref}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </a>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          ["Total tips", cents(totals.totalCents)],
          ["BOH", cents(totals.bohCents)],
          [period ? "FOH to pay" : "FOH", cents(totals.fohCents)],
          ["Shifts", String(totals.shifts)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 backdrop-blur-3xl">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-white/45">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight text-white tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {shifts.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-white/50">No cash-outs saved in this range yet.</p>
        </Panel>
      ) : (
        <>
          <Panel title={period ? "Who gets paid" : "FOH totals"} aside={formatHours(totals.hours)}>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="text-[11px] uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-1 pb-2 font-medium">Name</th>
                    <th className="px-1 pb-2 text-right font-medium">Shifts</th>
                    <th className="px-1 pb-2 text-right font-medium">Hours</th>
                    <th className="px-1 pb-2 text-right font-medium">Avg / hr</th>
                    <th className="px-1 pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {staffTotals.map((s) => (
                    <tr key={s.name.toLowerCase()}>
                      <td className="px-1 py-2.5 font-medium text-white/90">{s.name}</td>
                      <td className="px-1 py-2.5 text-right text-white/55">{s.shifts}</td>
                      <td className="px-1 py-2.5 text-right text-white/55">{+s.hours.toFixed(2)}</td>
                      <td className="px-1 py-2.5 text-right text-white/55">{cents(s.hours > 0 ? s.amountCents / s.hours : 0)}</td>
                      <td className="px-1 py-2.5 text-right font-semibold text-white">{cents(s.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Shifts" aside={`${shifts.length} saved`}>
            <ul className="space-y-2">
              {shifts.map((s) => (
                <li key={s.id}>
                  <details className="group rounded-2xl border border-white/5 bg-white/[0.04] open:bg-white/[0.06]">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white/90">{shiftDay(s.shiftDate)}</p>
                        <p className="text-xs text-white/45">
                          {shiftTime(s)} · {s.staff.length} FOH · {formatHours(s.totalHours)}
                        </p>
                      </div>
                      <span className="font-semibold text-white tabular-nums">{cents(s.totalCents)}</span>
                      <svg className="h-4 w-4 text-white/40 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" clipRule="evenodd" />
                      </svg>
                    </summary>
                    <div className="border-t border-white/5 px-4 pb-4 pt-3">
                      <p className="text-sm text-white/50">
                        Cash {cents(s.cashCents)} · Card {cents(s.cardCents)} · BOH {Math.round(s.bohShare * 100)}% {cents(s.bohCents)} · FOH{" "}
                        {cents(s.fohCents)}
                      </p>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {s.staff.map((p, i) => (
                          <li key={i} className="flex justify-between tabular-nums">
                            <span className="text-white/85">
                              {p.name} <span className="text-white/40">{formatHours(p.hours)}</span>
                            </span>
                            <span className="font-medium text-white">{cents(p.amountCents)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex justify-end">
                        {paidWeeks.includes(mondayOf(s.shiftDate)) ? (
                          <span className="px-3 py-1.5 text-sm text-white/35">Paid week · locked</span>
                        ) : (
                          <DeleteShiftButton id={s.id} />
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </Shell>
  );
}
