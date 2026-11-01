"use client";

import { useActionState } from "react";
import { addStaffAction, setBohShareAction, setStaffActiveAction, updateStaffAction, type SettingsState } from "../../actions";
import type { StaffMember } from "@/lib/staff";

const input =
  "h-11 w-full rounded-xl border border-white/5 bg-black/25 px-3 text-[15px] text-white placeholder:text-white/25 focus:border-white/20 focus:bg-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/60";
const primary =
  "h-11 shrink-0 rounded-xl bg-white/90 px-4 text-sm font-semibold text-black transition-colors hover:bg-white disabled:opacity-50";

function Status({ state }: { state: SettingsState }) {
  if (state.error) return <p className="mt-2 text-sm text-rose-300">{state.error}</p>;
  if (state.ok) return <p className="mt-2 text-sm text-emerald-300">{state.ok}</p>;
  return null;
}

export function BohForm({ current }: { current: number }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(setBohShareAction, {});
  return (
    <form action={action}>
      <div className="flex items-end gap-2.5">
        <div className="flex-1">
          <label htmlFor="boh" className="mb-1.5 block text-sm text-white/55">
            Kitchen (BOH) share of all tips
          </label>
          <div className="relative">
            <input id="boh" name="boh" type="text" inputMode="decimal" defaultValue={+(current * 100).toFixed(1)} className={`${input} pr-8`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">%</span>
          </div>
        </div>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function AddStaffForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addStaffAction, {});
  return (
    <form action={action} key={state.ok} className="rounded-2xl border border-dashed border-white/15 p-3.5">
      <p className="mb-2.5 text-sm font-medium text-white/70">Add someone</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input name="name" placeholder="Name" aria-label="Name" required maxLength={40} className={input} />
        <input name="email" type="email" placeholder="Email (for pay stubs)" aria-label="Email" className={input} />
        <input name="phone" type="tel" placeholder="Phone (optional)" aria-label="Phone" className={input} />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function StaffRow({ person }: { person: StaffMember }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateStaffAction, {});
  return (
    <li className={`rounded-2xl border border-white/5 bg-white/[0.04] p-3.5 ${person.active ? "" : "opacity-60"}`}>
      <form action={action}>
        <input type="hidden" name="id" value={person.id} />
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input name="name" defaultValue={person.name} aria-label="Name" required maxLength={40} className={`${input} font-medium`} />
          <input name="email" type="email" defaultValue={person.email ?? ""} placeholder="Email" aria-label={`${person.name}'s email`} className={input} />
          <input name="phone" type="tel" defaultValue={person.phone ?? ""} placeholder="Phone" aria-label={`${person.name}'s phone`} className={input} />
          <button type="submit" disabled={pending} className="h-11 rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
      <div className="mt-2 flex items-center justify-between">
        <Status state={state} />
        <form action={setStaffActiveAction} className="ml-auto">
          <input type="hidden" name="id" value={person.id} />
          <input type="hidden" name="active" value={String(!person.active)} />
          <button type="submit" className="rounded-full px-3 py-1 text-sm text-white/45 transition-colors hover:bg-white/10 hover:text-white">
            {person.active ? "Remove from calculator" : "Bring back"}
          </button>
        </form>
      </div>
    </li>
  );
}
