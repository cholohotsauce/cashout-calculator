import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isManager } from "@/lib/auth";
import { getShift, paidWeekStarts, restaurantTimeZone } from "@/lib/history";
import { getBohShare, listStaff } from "@/lib/staff";
import { businessDate, formatDay, isIsoDate } from "@/lib/payroll";
import { SERVICES, isService } from "@/lib/cashout";
import { Panel, Shell } from "../ui";
import { ShiftEditor, type EditorShift } from "./ShiftEditor";

export const metadata: Metadata = { title: "Fix a shift · The Ace" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Edit a saved cash-out (?id=…) or add one that was never saved on the night (?date=…).
 * Saving updates that pay week's totals, since they're always added up from the saved shifts.
 */
export default async function ShiftPage({ searchParams }: PageProps<"/history/shift">) {
  await connection();
  if (!isDatabaseConfigured() || !(await isManager())) redirect("/history");

  const params = await searchParams;
  const id = typeof params.id === "string" && UUID.test(params.id) ? params.id : null;
  const [saved, roster, bohShare, paidWeeks, zone] = await Promise.all([
    id ? getShift(id) : null,
    listStaff(),
    getBohShare(),
    paidWeekStarts(),
    restaurantTimeZone(),
  ]);
  if (id && !saved) notFound();
  const today = businessDate(zone);

  const shift: EditorShift = saved
    ? {
        id: saved.id,
        shiftDate: saved.shiftDate,
        service: saved.service,
        cash: saved.cashCents / 100,
        card: saved.cardCents / 100,
        staff: saved.staff.map((s) => ({ name: s.name, hours: s.hours })),
        bohShare: saved.bohShare,
      }
    : {
        id: randomUUID(),
        shiftDate: isIsoDate(params.date) && params.date <= today ? params.date : "",
        service: isService(params.service) ? params.service : null,
        cash: 0,
        card: 0,
        staff: [],
        bohShare,
      };

  const heading = saved
    ? `Edit ${formatDay(saved.shiftDate)}${saved.service ? ` ${SERVICES[saved.service].toLowerCase()}` : ""}`
    : "Add a missed shift";

  return (
    <Shell signedIn section="history" title="Fix a shift">
      <Link href="/history" className="inline-flex items-center gap-1 px-1 text-sm text-white/50 hover:text-white">
        ← Payday & history
      </Link>
      <Panel title={heading}>
        <p className="-mt-2 mb-5 text-sm text-white/50">
          {saved
            ? "Correct the tips, hours or date. The split is worked out again with the kitchen share this shift was saved with, and the change log keeps the old numbers."
            : "For a night nobody saved on the calculator. Enter what was in the envelope and who worked; it counts toward that week's payday like any other shift."}
        </p>
        <ShiftEditor
          shift={shift}
          isNew={!saved}
          roster={roster.filter((s) => s.active).map((s) => s.name)}
          today={today}
          paidWeeks={paidWeeks}
        />
      </Panel>
    </Shell>
  );
}
