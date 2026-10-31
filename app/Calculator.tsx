"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BOH_SHARE,
  CashOut,
  calculateCashOut,
  cashOutToText,
  formatHours,
  formatMoney,
  parseAmount,
  sanitizeDecimal,
} from "@/lib/cashout";
import { Toast, useToast } from "./components/Toast";
import { Backdrop } from "./components/Backdrop";
import { saveCashOutAction } from "./actions";

type SaveState = { status: "idle" | "saving" | "error" } | { status: "saved"; key: string };

/**
 * The shift's calendar date. A close that runs past midnight still belongs to the night
 * before, so anything before 5am counts as the previous day.
 */
function shiftDate(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 5) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Loaded after the first calculation so Save PDF can run straight from the tap
// (iPad Safari can block downloads that start after an await).
let pdfModule: typeof import("@/lib/pdf") | null = null;

const EXTRA = "Extra Person";
const DEFAULT_STAFF = ["Archie", "Asa", "Chloe", "Daniel", "Devon", "Karyn", "Liam", "Nat", "Wes", EXTRA];

const fieldClass =
  "w-full h-14 rounded-2xl border bg-black/25 px-4 text-lg font-medium tracking-tight text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] placeholder:text-white/25 transition-colors focus:bg-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/60";

const cardMotion = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: "easeOut" as const, delay },
});

function Card({ step, title, aside, children }: { step: number; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-xl backdrop-blur-3xl sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-copper/20 text-xs font-semibold text-copper-light ring-1 ring-copper/40">
          {step}
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-white/90">{title}</h2>
        {aside && <div className="ml-auto text-sm text-white/45">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function MoneyInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-white/55">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/35">$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(sanitizeDecimal(e.target.value))}
          className={`${fieldClass} border-white/5 pl-8 focus:border-white/20`}
        />
      </div>
    </div>
  );
}

export function Calculator({ historyEnabled }: { historyEnabled: boolean }) {
  const [cashTips, setCashTips] = useState("");
  const [cardTips, setCardTips] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffHours, setStaffHours] = useState<Record<string, string>>({});
  const [extraName, setExtraName] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [results, setResults] = useState<(CashOut & { key: string }) | null>(null);
  const [logoClicks, setLogoClicks] = useState(0);
  // One id per shift, so saving again after a correction updates the same history entry.
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const resultsRef = useRef<HTMLDivElement>(null);
  const { toast, show, dismiss } = useToast();

  // Everything below the inputs is derived live, so the sticky bar can preview the split as you type.
  const live = useMemo(() => {
    const cash = parseAmount(cashTips);
    const card = parseAmount(cardTips);
    const name = (s: string) => (s === EXTRA && extraName.trim() ? extraName.trim() : s);
    const staff = selectedStaff.map((s) => ({ id: s, name: name(s), hours: parseAmount(staffHours[s] ?? "") }));
    const missingHours = staff.filter((s) => s.hours <= 0).map((s) => s.id);
    const preview = calculateCashOut(cash, card, staff);
    const key = JSON.stringify([cash, card, staff]);
    return { cash, card, staff, missingHours, preview, key };
  }, [cashTips, cardTips, selectedStaff, staffHours, extraName]);

  const isStale = results !== null && results.key !== live.key;

  const toggleStaff = (staff: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staff)
        ? prev.filter((s) => s !== staff)
        : DEFAULT_STAFF.filter((s) => s === staff || prev.includes(s)),
    );
  };

  const handleLogoClick = () => {
    const next = logoClicks + 1;
    if (next === 5) {
      show("Marico el que lo lea :)");
      setLogoClicks(0);
    } else {
      setLogoClicks(next);
    }
  };

  const calculate = () => {
    setShowErrors(true);
    if (live.preview.totalTips <= 0) {
      show("Enter the cash or card tips first.", "error");
      return;
    }
    if (selectedStaff.length === 0) {
      show("Pick at least one FOH staff member.", "error");
      return;
    }
    if (live.missingHours.length > 0) {
      const n = live.missingHours.length;
      show(`Add hours for ${n === 1 ? live.staff.find((s) => s.id === live.missingHours[0])?.name : `${n} people`}.`, "error");
      return;
    }
    setShowErrors(false);
    dismiss();
    import("@/lib/pdf").then((m) => (pdfModule = m)).catch(() => {});
    setResults({ ...calculateCashOut(live.cash, live.card, live.staff), key: live.key });
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const reset = () => {
    setCashTips("");
    setCardTips("");
    setSelectedStaff([]);
    setStaffHours({});
    setExtraName("");
    setShowErrors(false);
    setResults(null);
    setShiftId(null);
    setSave({ status: "idle" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyToClipboard = async () => {
    if (!results) return;
    try {
      await navigator.clipboard.writeText(cashOutToText(results));
      show("Copied to clipboard", "success");
    } catch {
      show("Couldn't copy. Try the PDF instead.", "error");
    }
  };

  const shareWhatsApp = () => {
    if (!results) return;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(cashOutToText(results))}`, "_blank", "noopener");
  };

  const saveToHistory = async () => {
    if (!results || save.status === "saving") return;
    const id = shiftId ?? crypto.randomUUID();
    setShiftId(id);
    setSave({ status: "saving" });
    const key = results.key;
    try {
      const res = await saveCashOutAction({
        id,
        cash: live.cash,
        card: live.card,
        staff: live.staff.map(({ name, hours }) => ({ name, hours })),
        shiftDate: shiftDate(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (res.ok) {
        setSave({ status: "saved", key });
        show(shiftId ? "Saved shift updated" : "Saved to shift history", "success");
      } else {
        setSave({ status: "error" });
        show(res.error, "error");
      }
    } catch {
      setSave({ status: "error" });
      show("Couldn't save. Check the connection and try again.", "error");
    }
  };

  const isSaved = save.status === "saved" && results !== null && save.key === results.key;

  const savePdf = async () => {
    if (!results) return;
    const pdf = pdfModule ?? (pdfModule = await import("@/lib/pdf"));
    pdf.saveCashOutPdf(results);
    show("PDF saved", "success");
  };

  const tipsMissing = showErrors && live.preview.totalTips <= 0;
  const staffMissing = showErrors && selectedStaff.length === 0;

  return (
    <div className="relative min-h-screen bg-black pb-40 font-sans selection:bg-copper/40">
      <Backdrop />

      <main className="relative z-10 mx-auto w-full max-w-2xl space-y-5 p-4 sm:p-8">
        <header className="relative flex flex-col items-center pb-3 pt-6">
          {historyEnabled && (
            <Link
              href="/history"
              className="absolute right-0 top-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </Link>
          )}
          <button type="button" onClick={handleLogoClick} aria-label="The Ace" className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/TheAce_BlackLogo.png" alt="The Ace" className="h-12 object-contain opacity-80 invert" />
          </button>
          <h1 className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/45">Tip Cash-Out</h1>
        </header>

        <motion.div {...cardMotion()}>
          <Card step={1} title="Collected tips" aside={live.preview.totalTips > 0 && formatMoney(live.preview.totalTips)}>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <MoneyInput id="cash" label="Cash" value={cashTips} onChange={setCashTips} />
              <MoneyInput id="card" label="Card" value={cardTips} onChange={setCardTips} />
            </div>
            {tipsMissing && <p className="mt-3 text-sm text-rose-300">Enter at least one tip amount.</p>}
          </Card>
        </motion.div>

        <motion.div {...cardMotion(0.08)}>
          <Card step={2} title="FOH staff on shift" aside={selectedStaff.length > 0 && `${selectedStaff.length} selected`}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {DEFAULT_STAFF.map((staff) => {
                const isSelected = selectedStaff.includes(staff);
                return (
                  <button
                    type="button"
                    key={staff}
                    aria-pressed={isSelected}
                    onClick={() => toggleStaff(staff)}
                    className={`flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 active:scale-[0.97] ${
                      isSelected
                        ? "border-white bg-white/90 font-semibold text-black shadow-[0_0_18px_rgba(255,255,255,0.15)]"
                        : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                    }`}
                  >
                    {isSelected && (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {staff === EXTRA ? "+ Extra" : staff}
                  </button>
                );
              })}
            </div>
            {staffMissing && <p className="mt-3 text-sm text-rose-300">Pick at least one person.</p>}

            <AnimatePresence initial={false}>
              {selectedStaff.includes(EXTRA) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label htmlFor="extra-name" className="mb-2 mt-4 block text-sm font-medium text-white/55">
                    Extra person&apos;s name
                  </label>
                  <input
                    id="extra-name"
                    type="text"
                    placeholder="Name"
                    value={extraName}
                    onChange={(e) => setExtraName(e.target.value)}
                    className={`${fieldClass} border-white/5 focus:border-white/20`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        <AnimatePresence initial={false}>
          {selectedStaff.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3 }}
            >
              <Card step={3} title="Hours worked" aside={live.preview.totalHours > 0 && formatHours(live.preview.totalHours)}>
                <ul className="space-y-2.5">
                  {live.staff.map((s, i) => {
                    const invalid = showErrors && s.hours <= 0;
                    const estimate = live.preview.staffTips[i]?.amount ?? 0;
                    return (
                      <li key={s.id} className="flex items-center gap-3">
                        <label htmlFor={`hours-${s.id}`} className="w-24 shrink-0 truncate text-base font-medium text-white/90 sm:w-32">
                          {s.name}
                        </label>
                        <div className="relative flex-1">
                          <input
                            id={`hours-${s.id}`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            aria-invalid={invalid}
                            value={staffHours[s.id] ?? ""}
                            onChange={(e) => setStaffHours((prev) => ({ ...prev, [s.id]: sanitizeDecimal(e.target.value) }))}
                            className={`${fieldClass} h-12 pr-10 ${invalid ? "border-rose-400/70" : "border-white/5 focus:border-white/20"}`}
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/35">hrs</span>
                        </div>
                        <span className="w-20 shrink-0 text-right text-sm tabular-nums text-white/50">
                          {s.hours > 0 && live.preview.totalTips > 0 ? formatMoney(estimate) : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {results && (
            <motion.section
              ref={resultsRef}
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }}
              className="scroll-mt-6 rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur-3xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white/90">Cash-out</h2>
                  <p className="mt-0.5 text-xs text-white/45">{results.dateTime}</p>
                </div>
                <button type="button" onClick={reset} className="rounded-full px-3 py-1.5 text-sm text-white/55 transition-colors hover:bg-white/10 hover:text-white">
                  New shift
                </button>
              </div>

              {isStale && (
                <button
                  type="button"
                  onClick={calculate}
                  className="mt-4 w-full rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-left text-sm text-amber-100"
                >
                  Inputs changed since this cash-out. <span className="font-semibold underline underline-offset-2">Recalculate</span>
                </button>
              )}

              <div className="mt-6 text-center">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">Total tips</p>
                <p className="mt-1 text-5xl font-semibold tracking-tight text-white tabular-nums">{formatMoney(results.totalTips)}</p>
                <p className="mt-2 text-sm text-white/45">
                  Cash {formatMoney(results.cash)} · Card {formatMoney(results.card)}
                </p>
              </div>

              <dl className="mt-6 grid grid-cols-3 gap-2.5">
                {[
                  [`BOH ${Math.round(BOH_SHARE * 100)}%`, formatMoney(results.bohTips)],
                  ["FOH pool", formatMoney(results.fohTips)],
                  ["Per hour", formatMoney(results.fohRate)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/5 bg-black/20 px-3 py-3 text-center">
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-white/45">{label}</dt>
                    <dd className="mt-1 text-base font-semibold text-white tabular-nums sm:text-lg">{value}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mb-3 mt-7 text-xs font-medium uppercase tracking-[0.2em] text-white/45">Staff breakdown</h3>
              <ul className="space-y-2">
                {results.staffTips.map((s, i) => (
                  <li key={i} className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3.5">
                    <div
                      className="absolute inset-y-0 left-0 bg-copper/15"
                      style={{ width: `${results.fohTips > 0 ? (s.amount / results.fohTips) * 100 : 0}%` }}
                      aria-hidden
                    />
                    <div className="relative flex items-center justify-between">
                      <span className="font-medium text-white/90">
                        {s.name}
                        <span className="ml-2 text-sm font-normal text-white/40">{formatHours(s.hours)}</span>
                      </span>
                      <span className="font-semibold text-white tabular-nums">{formatMoney(s.amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {historyEnabled && (
                <button
                  type="button"
                  onClick={saveToHistory}
                  disabled={isStale || isSaved || save.status === "saving"}
                  className={`mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                    isSaved
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      : "border-copper/40 bg-copper/20 text-copper-light hover:bg-copper/30 disabled:opacity-40"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    {isSaved ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 7c0 2 3.6 3 8 3s8-1 8-3M4 7c0-2 3.6-3 8-3s8 1 8 3m0 5c0 2-3.6 3-8 3s-8-1-8-3" />
                    )}
                  </svg>
                  {save.status === "saving"
                    ? "Saving…"
                    : isSaved
                      ? "Saved to shift history"
                      : shiftId
                        ? "Update saved shift"
                        : "Save to shift history"}
                </button>
              )}

              <div className={`${historyEnabled ? "mt-2.5" : "mt-7"} grid grid-cols-3 gap-2.5`}>
                {[
                  { label: "Copy", onClick: copyToClipboard, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /> },
                  { label: "WhatsApp", onClick: shareWhatsApp, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
                  { label: "Save PDF", onClick: savePdf, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /> },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.onClick}
                    aria-label={a.label}
                    disabled={isStale}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      {a.icon}
                    </svg>
                    <span className="hidden sm:inline">{a.label}</span>
                    <span className="sm:hidden">{a.label === "Save PDF" ? "PDF" : a.label}</span>
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <Toast toast={toast} />

      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-white/10 bg-black/50 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-2.5 flex justify-between px-1 text-xs text-white/50 tabular-nums">
            <span>
              Tips <span className="text-white/85">{formatMoney(live.preview.totalTips)}</span>
            </span>
            <span>
              BOH <span className="text-white/85">{formatMoney(live.preview.bohTips)}</span>
            </span>
            <span>
              FOH <span className="text-white/85">{live.preview.totalHours > 0 ? `${formatMoney(live.preview.fohRate)}/hr` : "—"}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={calculate}
            className="h-14 w-full rounded-[20px] bg-white/90 text-lg font-semibold text-black shadow-[0_0_18px_rgba(255,255,255,0.15)] transition-transform hover:scale-[1.01] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
          >
            Calculate cash-out
          </button>
        </div>
      </div>
    </div>
  );
}
