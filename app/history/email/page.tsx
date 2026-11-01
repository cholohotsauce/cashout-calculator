import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isManager } from "@/lib/auth";
import { loadHistory } from "@/lib/history";
import { buildPaydayEmail, canSendEmail, isEmailConfigured, payrollRecipients } from "@/lib/email";
import { addDays, formatDay } from "@/lib/payroll";
import { buildStubEmail, weekStubs } from "@/lib/stubs";
import { listStaff } from "@/lib/staff";
import { Backdrop } from "../../components/Backdrop";

export const metadata: Metadata = { title: "Payday email preview · The Ace" };

/** Shows exactly what the Thursday email for a pay week looks like, without sending it. */
export default async function EmailPreviewPage({ searchParams }: PageProps<"/history/email">) {
  await connection();
  if (!isDatabaseConfigured() || !(await isManager())) redirect("/history");

  const { week, stub: stubName } = await searchParams;
  const history = await loadHistory("payday", typeof week === "string" ? week : undefined);
  const period = history.period!;
  const [stubs, staff] = await Promise.all([weekStubs(period.weekStart), listStaff()]);
  const emailOf = new Map(staff.map((s) => [s.name.toLowerCase(), s.email]));
  const stub = typeof stubName === "string" ? stubs.find((s) => s.name.toLowerCase() === stubName.toLowerCase()) : undefined;
  const email = stub ? buildStubEmail(stub) : buildPaydayEmail(history);
  const recipients = stub ? [emailOf.get(stub.name.toLowerCase())].filter((e): e is string => Boolean(e)) : payrollRecipients();
  const sendsOn = stub
    ? "When the week is marked paid"
    : `${formatDay(addDays(period.payday, -1), { weekday: "long", month: "short", day: "numeric" })}, around 9am Eastern`;
  const tab = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors ${active ? "bg-copper/25 font-semibold text-copper-light ring-1 ring-copper/40" : "text-white/55 hover:bg-white/10 hover:text-white"}`;

  return (
    <div className="relative min-h-screen bg-black pb-16 font-sans">
      <Backdrop />
      <main className="relative z-10 mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-8">
        <header className="flex items-center justify-between pb-2 pt-4">
          <Link
            href={`/history?range=payday&week=${period.weekStart}`}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z" clipRule="evenodd" />
            </svg>
            Payday
          </Link>
          <h1 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">Email preview</h1>
          <span className="w-[84px]" />
        </header>

        <nav aria-label="Which email" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          <Link href={`/history/email?week=${period.weekStart}`} className={tab(!stub)}>
            Rafa&apos;s payday email
          </Link>
          {stubs.map((s) => (
            <Link key={s.name} href={`/history/email?week=${period.weekStart}&stub=${encodeURIComponent(s.name)}`} className={tab(stub?.name === s.name)}>
              {s.name}&apos;s stub
            </Link>
          ))}
        </nav>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 text-sm backdrop-blur-3xl sm:p-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-white/45">To</dt>
            <dd className="text-white/90">{recipients.length ? (
                recipients.join(", ")
              ) : (
                <span className="text-amber-200">{stub ? `No email on file for ${stub.name}. Add one in Staff & settings.` : "PAYROLL_EMAIL isn't set yet"}</span>
              )}</dd>
            <dt className="text-white/45">Subject</dt>
            <dd className="font-medium text-white">{email.subject}</dd>
            <dt className="text-white/45">Sends</dt>
            <dd className="text-white/90">
              {sendsOn}
              {!(stub ? canSendEmail() : isEmailConfigured()) && <span className="text-amber-200"> (sending isn&apos;t switched on yet)</span>}
            </dd>
            {email.attachments.map((a) => (
              <div key={a.filename} className="contents">
                <dt className="text-white/45">Attached</dt>
                <dd className="text-white/90">{a.filename}</dd>
              </div>
            ))}
          </dl>
        </section>

        <iframe
          title="Email preview"
          srcDoc={email.html}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className={`${stub ? "h-[920px]" : "h-[1100px]"} w-full rounded-[28px] border border-white/10 bg-[#f5f5f4]`}
        />
      </main>
    </div>
  );
}
