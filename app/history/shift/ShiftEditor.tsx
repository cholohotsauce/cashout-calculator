"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SERVICES, calculateCashOut, formatHours, formatMoney, parseAmount, sanitizeDecimal, type Service } from "@/lib/cashout";
import { formatDay, mondayOf } from "@/lib/payroll";
import { saveShiftAsManagerAction } from "../../actions";

const input =
  "h-11 w-full rounded-xl border border-white/5 bg-black/25 px-3 text-[15px] text-white placeholder:text-white/25 focus:border-white/20 focus:bg-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/60";
const label = "mb-1.5 block text-sm text-white/55";

export type EditorShift = {
  id: string;
  shiftDate: string;
  service: Service | null;
  cash: number;
  card: number;
  staff: { name: string; hours: number }[];
  bohShare: number;
};

type Row = { name: string; hours: string };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const money = (n: number) => (n ? String(+n.toFixed(2)) : "");

/** The form behind "Add a missed shift" and "Edit": date, brunch or night, tips, and who worked. */
export function ShiftEditor({
  shift,
  isNew,
  roster,
  today,
  paidWeeks,
}: {
  shift: EditorShift;
  isNew: boolean;
  roster: string[];
  today: string;
  paidWeeks: string[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(shift.shiftDate);
  const [service, setService] = useState<Service | null>(shift.service);
  const [cash, setCash] = useState(money(shift.cash));
  const [card, setCard] = useState(money(shift.card));
  const [rows, setRows] = useState<Row[]>(shift.staff.map((s) => ({ name: s.name, hours: String(s.hours) })));
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // People who worked this shift but are no longer on the roster still show as chips.
  const names = useMemo(() => {
    const out = [...roster];
    for (const r of shift.staff) if (!out.some((n) => sameName(n, r.name))) out.push(r.name);
    return out;
  }, [roster, shift.staff]);

  const isOn = (name: string) => rows.some((r) => sameName(r.name, name));
  const toggle = (name: string) =>
    setRows((rs) => (rs.some((r) => sameName(r.name, name)) ? rs.filter((r) => !sameName(r.name, name)) : [...rs, { name, hours: "" }]));
  const setHours = (name: string, hours: string) => setRows((rs) => rs.map((r) => (r.name === name ? { ...r, hours: sanitizeDecimal(hours) } : r)));
  const addExtra = () => {
    const name = extra.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (!isOn(name)) setRows((rs) => [...rs, { name, hours: "" }]);
    setExtra("");
  };

  const staff = rows.map((r) => ({ name: r.name, hours: parseAmount(r.hours) }));
  const preview = calculateCashOut(parseAmount(cash), parseAmount(card), staff.filter((s) => s.hours > 0), new Date(), shift.bohShare);
  const locked = date ? paidWeeks.includes(mondayOf(date)) : false;

  const problem =
    !date ? "Pick the date of the shift."
    : date > today ? "That date hasn't happened yet."
    : preview.totalTips <= 0 ? "Enter the cash and card tips."
    : rows.length === 0 ? "Pick who worked."
    : staff.some((s) => s.hours <= 0 || s.hours > 24) ? "Enter hours (up to 24) for everyone picked."
    : null;

  const save = () => {
    setError(null);
    if (problem) return setError(problem);
    startSaving(async () => {
      const res = await saveShiftAsManagerAction({ id: shift.id, shiftDate: date, service, cash: parseAmount(cash), card: parseAmount(card), staff });
      if (!res.ok) return setError(res.error);
      router.push(`/history?range=payday&week=${res.week}`);
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className={label}>
            Date of the shift
          </label>
          <input id="date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={`${input} [color-scheme:dark]`} />
          {date && <p className="mt-1.5 text-xs text-white/40">{formatDay(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>}
        </div>
        <div>
          <span className={label}>Service</span>
          <div role="radiogroup" aria-label="Service" className="flex gap-1.5 rounded-xl border border-white/5 bg-black/25 p-1">
            {([null, ...Object.keys(SERVICES)] as (Service | null)[]).map((key) => (
              <button
                key={key ?? "none"}
                type="button"
                role="radio"
                aria-checked={service === key}
                onClick={() => setService(key)}
                className={`h-9 flex-1 rounded-lg text-sm font-medium transition-colors ${
                  service === key ? "bg-white/90 text-black" : "text-white/55 hover:bg-white/10 hover:text-white"
                }`}
              >
                {key ? SERVICES[key] : "Whole day"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-white/40">Pick one when brunch and night were cashed out separately.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(
          [
            ["cash", "Cash tips", cash, setCash],
            ["card", "Card tips (the machine)", card, setCard],
          ] as const
        ).map(([id, text, value, set]) => (
          <div key={id}>
            <label htmlFor={id} className={label}>
              {text}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
              <input
                id={id}
                inputMode="decimal"
                placeholder="0.00"
                value={value}
                onChange={(e) => set(sanitizeDecimal(e.target.value))}
                className={`${input} pl-7 tabular-nums`}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <span className={label}>Who worked</span>
        <div className="flex flex-wrap gap-2">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={isOn(name)}
              onClick={() => toggle(name)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                isOn(name) ? "bg-copper/30 text-copper-light ring-1 ring-copper/50" : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex gap-2">
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value.slice(0, 40))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addExtra();
              }
            }}
            placeholder="Someone else (name)"
            aria-label="Add someone not on the roster"
            className={input}
          />
          <button type="button" onClick={addExtra} className="h-11 shrink-0 rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/20">
            Add
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => {
            const amount = preview.staffTips.find((s) => s.name === r.name)?.amount ?? 0;
            return (
              <li key={r.name} className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.04] px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate font-medium text-white/90">{r.name}</span>
                <div className="relative w-[4.5rem] shrink-0 sm:w-24">
                  <input
                    inputMode="decimal"
                    aria-label={`${r.name}'s hours`}
                    placeholder="0"
                    value={r.hours}
                    onChange={(e) => setHours(r.name, e.target.value)}
                    className={`${input} h-10 pr-7 text-right tabular-nums`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/40">h</span>
                </div>
                <span className="shrink-0 text-right font-semibold sm:w-20 tabular-nums text-white">{formatMoney(amount)}</span>
                <button
                  type="button"
                  onClick={() => toggle(r.name)}
                  aria-label={`Remove ${r.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M6.3 5.3a1 1 0 00-1.4 1.4L8.6 10l-3.7 3.3a1 1 0 101.4 1.4L10 11.4l3.7 3.3a1 1 0 001.4-1.4L11.4 10l3.7-3.3a1 1 0 00-1.4-1.4L10 8.6 6.3 5.3z" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="grid grid-cols-3 gap-2.5 rounded-2xl border border-white/10 bg-black/20 p-3.5 text-center tabular-nums">
        {[
          ["Total", preview.totalTips],
          [`BOH ${+(shift.bohShare * 100).toFixed(1)}%`, preview.bohTips],
          [`FOH · ${formatHours(preview.totalHours)}`, preview.fohTips],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wider text-white/45">{k}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-white">{formatMoney(v as number)}</dd>
          </div>
        ))}
      </dl>

      {locked && (
        <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          The week of {formatDay(mondayOf(date))} is already marked paid. Unlock it on the Payday tab before saving a change to it.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2.5">
        <button type="button" onClick={() => router.back()} className="rounded-full px-4 py-2.5 text-sm text-white/60 hover:bg-white/10 hover:text-white">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || locked}
          className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white disabled:opacity-50"
        >
          {saving ? "Saving…" : isNew ? "Add shift" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
