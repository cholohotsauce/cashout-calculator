import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { formatHours, formatMoney } from "@/lib/cashout";
import { isDatabaseConfigured } from "@/lib/db";
import { isManager, isPinConfigured } from "@/lib/auth";
import { RANGES, isRangeKey, loadHistory, type RangeKey, type SavedShift } from "@/lib/history";
import { Backdrop } from "../components/Backdrop";
import { logoutAction } from "../actions";
import { PinForm } from "./PinForm";
import { DeleteShiftButton } from "./DeleteShiftButton";

export const metadata: Metadata = { title: "Shift history · The Ace" };

const cents = (c: number) => formatMoney(c / 100);

function Panel({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-xl backdrop-blur-3xl sm:p-6">
      {title && (
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-white/90">{title}</h2>
          {aside && <div className="ml-auto text-sm text-white/45">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function Shell({ children, signedIn = false }: { children: ReactNode; signedIn?: boolean }) {
  return (
    <div className="relative min-h-screen bg-black pb-16 font-sans selection:bg-copper/40">
      <Backdrop />
      <main className="relative z-10 mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-8">
        <header className="flex items-center justify-between pb-2 pt-4">
          <Link href="/" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z" clipRule="evenodd" />
            </svg>
            Calculator
          </Link>
          <h1 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">Shift History</h1>
          {signedIn ? (
            <form action={logoutAction}>
              <button type="submit" className="rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                Lock
              </button>
            </form>
          ) : (
            <span className="w-[84px]" />
          )}
        </header>
        {children}
      </main>
    </div>
  );
}

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

  const rangeParam = (await searchParams).range;
  const range: RangeKey = isRangeKey(rangeParam) ? rangeParam : "week";
  const { from, to, shifts, staffTotals, totals } = await loadHistory(range);

  return (
    <Shell signedIn>
      <nav className="flex gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-white/[0.05] p-1.5 backdrop-blur-3xl" aria-label="Date range">
        {(Object.keys(RANGES) as RangeKey[]).map((key) => (
          <Link
            key={key}
            href={key === "week" ? "/history" : `/history?range=${key}`}
            aria-current={key === range ? "page" : undefined}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-center text-sm font-medium transition-colors ${
              key === range ? "bg-white/90 text-black" : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {RANGES[key]}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-white/50">{rangeLabel(from, to)}</p>
        {shifts.length > 0 && (
          <a
            href={`/history/export?range=${range}`}
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
          ["FOH", cents(totals.fohCents)],
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
          <Panel title="FOH totals" aside={formatHours(totals.hours)}>
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
                        <DeleteShiftButton id={s.id} />
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
