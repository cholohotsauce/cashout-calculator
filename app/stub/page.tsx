import type { Metadata } from "next";
import { connection } from "next/server";
import { formatMoney } from "@/lib/cashout";
import { isDatabaseConfigured } from "@/lib/db";
import { personStub, verifyStubToken } from "@/lib/stubs";
import { formatDay, formatRange } from "@/lib/payroll";
import { Backdrop } from "../components/Backdrop";
import { Panel } from "../history/ui";

export const metadata: Metadata = { title: "Pay stub · The Ace", robots: { index: false, follow: false } };

const money = (c: number) => formatMoney(c / 100);
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** A staff member's private stub for one week, opened from the link in their email. */
export default async function StubPage({ searchParams }: PageProps<"/stub">) {
  await connection();
  const q = await searchParams;
  const [week, name, token] = [one(q.w), one(q.n), one(q.t)];
  const stub = isDatabaseConfigured() && verifyStubToken(week, name, token) ? await personStub(week, name) : null;

  return (
    <div className="relative min-h-screen bg-black pb-16 font-sans">
      <Backdrop />
      <main className="relative z-10 mx-auto w-full max-w-md space-y-5 p-4 pt-10 sm:p-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-copper-light">The Ace · Pay stub</p>
        {!stub ? (
          <Panel>
            <p className="py-6 text-center text-white/60">This link isn&apos;t valid. Ask a manager to resend your stub.</p>
          </Panel>
        ) : (
          <>
            <Panel>
              <p className="text-center text-white/60">
                {stub.name} · week of {formatRange(stub.period.weekStart, stub.period.weekEnd)}
              </p>
              <p className="mt-2 text-center text-5xl font-semibold tracking-tight text-white">{money(stub.amountCents)}</p>
              <p className="mt-2 text-center text-sm text-white/45">
                {stub.nights.length} {stub.nights.length === 1 ? "night" : "nights"} · {+stub.hours.toFixed(2)} hours
                {stub.hours > 0 && ` · ${money(stub.amountCents / stub.hours)}/hr`}
              </p>
              <p className="mt-4 text-center text-sm text-white/60">
                {stub.paid ? "Paid" : "To be paid"} {formatDay(stub.period.payday, { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </Panel>
            <Panel title="By night">
              <table className="w-full text-left tabular-nums">
                <tbody className="divide-y divide-white/5">
                  {stub.nights.map((n, i) => (
                    <tr key={`${n.date}-${i}`}>
                      <td className="py-2.5 text-white/85">{formatDay(n.date)}</td>
                      <td className="py-2.5 text-right text-white/45">{+n.hours.toFixed(2)} h</td>
                      <td className="py-2.5 text-right font-semibold text-white">{money(n.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <p className="px-2 text-center text-xs text-white/35">Tips are split by hours worked each night, after the kitchen&apos;s share. If something looks off, talk to a manager.</p>
          </>
        )}
      </main>
    </div>
  );
}
