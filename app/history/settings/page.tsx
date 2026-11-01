import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isManager } from "@/lib/auth";
import { getBohShare, listStaff } from "@/lib/staff";
import { Panel, Shell } from "../ui";
import { AddStaffForm, BohForm, StaffRow } from "./forms";

export const metadata: Metadata = { title: "Staff & settings · The Ace" };

export default async function SettingsPage() {
  await connection();
  if (!isDatabaseConfigured() || !(await isManager())) redirect("/history");
  const [staff, bohShare] = await Promise.all([listStaff(), getBohShare()]);
  const active = staff.filter((s) => s.active);
  const archived = staff.filter((s) => !s.active);

  return (
    <Shell signedIn section="settings" title="Settings">
      <Panel title="Floor staff" aside={`${active.length} on the calculator`}>
        <p className="-mt-2 mb-4 text-sm text-white/50">
          These names appear on the calculator. Removing someone only hides them there; their past shifts stay in history.
          Anyone with an email gets their own pay stub when a week is marked paid.
        </p>
        <AddStaffForm />
        <ul className="mt-3 space-y-2">
          {active.map((p) => (
            <StaffRow key={p.id} person={p} />
          ))}
        </ul>
        {archived.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-white/50 hover:text-white/80">Removed ({archived.length})</summary>
            <ul className="mt-2 space-y-2">
              {archived.map((p) => (
                <StaffRow key={p.id} person={p} />
              ))}
            </ul>
          </details>
        )}
      </Panel>

      <Panel title="Tip split">
        <BohForm current={bohShare} />
        <p className="mt-3 text-sm text-white/45">
          The floor (FOH) gets the rest, shared by hours. A change applies to new cash-outs only; saved shifts keep the split they were made with.
        </p>
      </Panel>
    </Shell>
  );
}
