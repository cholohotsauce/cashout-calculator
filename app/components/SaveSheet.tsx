"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { formatMoney } from "@/lib/cashout";
import { SERVICES, type Service } from "@/lib/cashout";
import { addDays, formatDay } from "@/lib/payroll";
import { CountUp } from "./Motion";

export type SaveWhen = { date: string; service: Service };

const KNOB = 56;
const INSET = 4;

/** "Daniel Ruiz" → DR, "Archie" → Ar, so two first names starting alike stay apart. */
const initials = (name: string) => {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
};

const AVATAR = ["#e8b48f", "#d9a27a", "#f3d3bb", "#c4855a", "#e0bfa5", "#b8774c"];

/**
 * The pop-up after Calculate that asks whether this is a real cash-out. Sliding the knob across
 * saves it to history; "Just testing" closes it with nothing saved.
 */
export function SaveSheet({
  open,
  total,
  cash,
  card,
  staff,
  today,
  when,
  onWhen,
  updating,
  firstTime,
  onSave,
  onTest,
}: {
  open: boolean;
  total: number;
  cash: number;
  card: number;
  staff: string[];
  /** Tonight's business date (after 4am rollover). */
  today: string;
  when: SaveWhen;
  onWhen: (w: SaveWhen) => void;
  /** The shift was saved before and this will replace it. */
  updating: boolean;
  firstTime: boolean;
  onSave: () => void;
  onTest: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState(false);
  const reduce = useReducedMotion();

  // Start fresh each time it opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the sheet when it reopens
    setDone(false);
    setEditing(false);
  }, [open]);

  // Escape is the same as "Just testing".
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !done && onTest();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, done, onTest]);

  const finish = () => {
    if (done) return;
    setDone(true);
    try {
      navigator.vibrate?.(15);
    } catch {}
    setTimeout(onSave, reduce ? 150 : 900);
  };

  const days = [0, -1, -2].map((n) => addDays(today, n));
  const dayLabel = (d: string) => (d === today ? `Tonight · ${formatDay(d)}` : formatDay(d));
  const chip = (on: boolean) =>
    `h-11 rounded-full px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-copper ${
      on ? "bg-copper-light text-[#1a130f]" : "border border-white/15 bg-white/[0.06] text-white/80 hover:bg-white/10"
    }`;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-sheet-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={reduce ? { duration: 0 } : { type: "spring", damping: 30, stiffness: 320 }}
            className="relative m-2 mb-[max(0.5rem,env(safe-area-inset-bottom))] flex w-full max-w-md flex-col items-center gap-5 rounded-[36px] border border-white/12 bg-gradient-to-b from-[#261c16]/[0.97] to-[#100c0a]/[0.98] px-6 pb-7 pt-2.5 shadow-[0_-20px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <span className="h-1.5 w-10 rounded-full bg-white/20 sm:invisible" aria-hidden />

            <div className="flex flex-col items-center gap-1.5 text-center">
              <h2 id="save-sheet-title" className="text-[22px] font-semibold tracking-tight text-white">
                {updating ? "Update tonight’s tips?" : "Lock in tonight’s tips?"}
              </h2>
              {firstTime && <p className="max-w-[290px] text-sm leading-snug text-white/60">Saving is what gets everyone paid on Friday.</p>}
            </div>

            <div className="flex flex-col items-center gap-1">
              <CountUp
                value={total}
                from={0}
                format={formatMoney}
                className="text-[52px] font-semibold leading-none tracking-tight text-copper-light [text-shadow:0_0_30px_rgba(196,133,90,0.35)] tabular-nums"
              />
              <span className="text-[13px] text-white/55">
                {formatMoney(cash)} cash · {formatMoney(card)} on the machine
              </span>
            </div>

            <div className="flex flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={() => setEditing((e) => !e)}
                aria-expanded={editing}
                aria-label={`Shift: ${formatDay(when.date)}, ${SERVICES[when.service]}. Change`}
                className="flex h-11 items-center gap-2 rounded-full border border-copper-light/35 bg-copper/[0.12] px-4 text-sm font-medium text-[#f3d3bb] transition-colors hover:bg-copper/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
                  <rect x="3.5" y="5" width="17" height="15" rx="3" />
                  <path d="M8 3v4M16 3v4M3.5 10h17" />
                </svg>
                {when.date === today ? "Tonight" : formatDay(when.date)} · {SERVICES[when.service]}
                <svg className={`h-3.5 w-3.5 transition-transform ${editing ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <AnimatePresence initial={false}>
                {editing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center gap-2 overflow-hidden"
                  >
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {days.map((d) => (
                        <button key={d} type="button" aria-pressed={when.date === d} onClick={() => onWhen({ ...when, date: d })} className={chip(when.date === d)}>
                          {dayLabel(d)}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      {(Object.keys(SERVICES) as Service[]).map((s) => (
                        <button key={s} type="button" aria-pressed={when.service === s} onClick={() => onWhen({ ...when, service: s })} className={chip(when.service === s)}>
                          {SERVICES[s]}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center pl-1.5">
                {staff.slice(0, 7).map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    title={name}
                    style={{ background: AVATAR[i % AVATAR.length] }}
                    className="-ml-1.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-[#1a130f] text-xs font-bold text-[#1a130f]"
                  >
                    {initials(name)}
                  </span>
                ))}
                {staff.length > 7 && (
                  <span className="-ml-1.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-[#1a130f] bg-white/20 text-xs font-bold text-white">
                    +{staff.length - 7}
                  </span>
                )}
                <span className="ml-2.5 text-[13px] text-white/55">
                  {staff.length} on tonight
                </span>
              </div>
            </div>

            <SlideToSave label={updating ? "Slide to update" : "Slide to save"} done={done} onDone={finish} />

            <button
              type="button"
              onClick={onTest}
              disabled={done}
              className="min-h-11 px-3 text-sm text-white/50 transition-colors hover:text-white/80 focus:outline-none focus-visible:underline disabled:opacity-0"
            >
              Just testing, don’t save
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** A copper knob you drag all the way across. Tap or Enter on it also works, for keyboards and screen readers. */
function SlideToSave({ label, done, onDone }: { label: string; done: boolean; onDone: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(260);
  const x = useMotionValue(0);
  const fill = useTransform(x, (v) => v + KNOB + INSET * 2);
  const labelOpacity = useTransform(x, [0, max * 0.6], [0.85, 0]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setMax(el.clientWidth - KNOB - INSET * 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const complete = () => {
    animate(x, max, { duration: 0.15 });
    onDone();
  };

  return (
    <div
      ref={track}
      className="relative h-16 w-full touch-none select-none overflow-hidden rounded-full border border-copper-light/25 bg-black/45 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]"
    >
      <motion.div style={{ width: fill }} className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-copper/15 to-copper/55" aria-hidden />
      <motion.span style={{ opacity: labelOpacity }} className="pointer-events-none absolute inset-0 flex items-center justify-center pl-10 text-base font-semibold tracking-wide text-[#f3d3bb]" aria-hidden>
        {label}
      </motion.span>
      <AnimatePresence>
        {done && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-r from-[#b8774c] to-copper-light"
          >
            {!reduce && (
              <motion.span
                className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-white/55 to-transparent"
                initial={{ x: "-150%" }}
                animate={{ x: "350%" }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
                aria-hidden
              />
            )}
            <motion.svg
              className="h-9 w-9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a130f"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 300 }}
              role="img"
              aria-label="Saved"
            >
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.1 }} />
            </motion.svg>
          </motion.div>
        )}
      </AnimatePresence>
      {!done && (
        <motion.button
          type="button"
          aria-label={label}
          drag="x"
          dragConstraints={{ left: 0, right: max }}
          dragElastic={0.04}
          dragMomentum={false}
          style={{ x }}
          onDragEnd={() => {
            if (x.get() > max * 0.85) complete();
            else animate(x, 0, { type: "spring", damping: 22, stiffness: 300 });
          }}
          // A tap (no drag) on the knob nudges it, so people learn to slide. Keyboards save directly.
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
              e.preventDefault();
              complete();
            }
          }}
          onTap={() => {
            if (x.get() > 4) return;
            animate(x, [0, 28, 0], { duration: 0.5 });
          }}
          className="absolute left-1 top-1 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-gradient-to-b from-copper-light to-copper shadow-[0_4px_14px_rgba(196,133,90,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:cursor-grabbing"
        >
          <svg className="h-[22px] w-[22px]" fill="none" stroke="#1a130f" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </motion.button>
      )}
    </div>
  );
}
