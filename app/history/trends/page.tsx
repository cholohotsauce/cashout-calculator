import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { formatMoney } from "@/lib/cashout";
import { isDatabaseConfigured } from "@/lib/db";
import { isManager } from "@/lib/auth";
import { loadTrends } from "@/lib/trends";
import { addDays, formatDay, formatRange, mondayOf } from "@/lib/payroll";
import { Panel, Shell } from "../ui";
import { ColumnChart, LineChart, SplitBar } from "./charts";

export const metadata: Metadata = { title: "Trends · The Ace" };

const money = (c: number) => formatMoney(c / 100);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const short = (d: string) => formatDay(d, { month: "short", day: "numeric" });

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 backdrop-blur-3xl">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

export default async function TrendsPage() {
  await connection();
  if (!isDatabaseConfigured() || !(await isManager())) redirect("/history");
  const t = await loadTrends(12);
  const thisWeek = mondayOf(t.today);

  if (t.nights === 0) {
    return (
      <Shell signedIn section="trends" title="Trends">
        <Panel>
          <p className="py-6 text-center text-white/50">Trends appear once a few cash-outs have been saved.</p>
        </Panel>
      </Shell>
    );
  }

  const bestWeekday = t.weekdays.reduce((a, b) => (b.avgCents > a.avgCents ? b : a));

  return (
    <Shell signedIn section="trends" title="Trends">
      <p className="px-1 text-sm text-white/50">Last 12 weeks · {formatRange(t.from, addDays(thisWeek, 6))}</p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Avg night" value={money(t.avgNightCents)} sub={`${t.nights} nights saved`} />
        <Stat label="Floor $ / hour" value={money(t.fohPerHourCents)} sub="after the kitchen share" />
        <Stat label="Best weekday" value={WEEKDAYS[bestWeekday.weekday]} sub={`${money(bestWeekday.avgCents)} on average`} />
        <Stat label="Best night ever" value={t.best ? money(t.best.totalCents) : "—"} sub={t.best ? formatDay(t.best.date) : undefined} />
      </div>

      <Panel title="Tips per week" aside="all tips, before the split">
        <ColumnChart
          caption="Total tips collected per week for the last 12 weeks"
          columns={t.weeks.map((w) => ({
            key: w.weekStart,
            label: short(w.weekStart),
            value: w.totalCents / 100,
            current: w.weekStart === thisWeek,
            tooltip: (
              <>
                <p className="font-semibold text-white">{formatRange(w.weekStart, addDays(w.weekStart, 6))}</p>
                <p>
                  {money(w.totalCents)} · {w.nights} {w.nights === 1 ? "night" : "nights"}
                  {w.weekStart === thisWeek ? " · so far" : ""}
                </p>
              </>
            ),
          }))}
        />
      </Panel>

      <div className="grid gap-5 sm:grid-cols-2">
        <Panel title="Average night by weekday">
          <ColumnChart
            height={150}
            caption="Average tips per night for each day of the week"
            columns={t.weekdays.map((d) => ({
              key: String(d.weekday),
              label: WEEKDAYS[d.weekday],
              value: d.avgCents / 100,
              current: d.weekday === bestWeekday.weekday,
              tooltip: (
                <>
                  <p className="font-semibold text-white">{WEEKDAYS[d.weekday]}</p>
                  <p>
                    {money(d.avgCents)} average · {d.nights} {d.nights === 1 ? "night" : "nights"}
                  </p>
                </>
              ),
            }))}
          />
        </Panel>

        <Panel title="Floor pay per hour">
          <LineChart
            height={150}
            caption="FOH tips per hour worked, by week"
            format={(v) => formatMoney(v)}
            points={t.weeks.map((w) => ({
              key: w.weekStart,
              label: short(w.weekStart),
              value: w.hours > 0 ? w.fohCents / 100 / w.hours : null,
              tooltip: (
                <>
                  <p className="font-semibold text-white">Week of {short(w.weekStart)}</p>
                  <p>
                    {w.hours > 0 ? formatMoney(w.fohCents / 100 / w.hours) : "—"}/hr · {+w.hours.toFixed(2)} h
                  </p>
                </>
              ),
            }))}
          />
        </Panel>
      </div>

      <Panel title="How guests tip">
        <SplitBar
          parts={[
            { label: "Card", value: t.cardCents, display: money(t.cardCents), strong: true },
            { label: "Cash", value: t.cashCents, display: money(t.cashCents) },
          ]}
        />
      </Panel>

      <details className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 text-sm backdrop-blur-3xl sm:p-6">
        <summary className="cursor-pointer font-medium text-white/70">Show the numbers as a table</summary>
        <table className="mt-4 w-full text-left tabular-nums">
          <thead className="text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="pb-2 font-medium">Week of</th>
              <th className="pb-2 text-right font-medium">Nights</th>
              <th className="pb-2 text-right font-medium">Tips</th>
              <th className="pb-2 text-right font-medium">Floor $/hr</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-white/80">
            {t.weeks.map((w) => (
              <tr key={w.weekStart}>
                <td className="py-2">{short(w.weekStart)}</td>
                <td className="py-2 text-right">{w.nights}</td>
                <td className="py-2 text-right">{money(w.totalCents)}</td>
                <td className="py-2 text-right">{w.hours > 0 ? formatMoney(w.fohCents / 100 / w.hours) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Shell>
  );
}
