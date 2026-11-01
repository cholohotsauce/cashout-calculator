import type { ReactNode } from "react";

// Single-series charts drawn as plain HTML/SVG on the dark glass surface.
// One hue (copper) carries the data; the current/selected point uses the bright step,
// the rest the muted step. Text always uses ink tokens, never the data colour.

const COPPER = "#c4855a";
const COPPER_MUTED = "rgba(196,133,90,0.55)";

/** Rounds an axis maximum up to a clean step so ticks read 0 / 1,000 / 2,000. */
function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= max / 3)! * pow;
  return Math.ceil(max / step) * step;
}

/** One style per axis: compact (0 / 5K / 10K) once the axis reaches 10,000, in full below that. */
function tickFormat(max: number) {
  return (n: number) => (n === 0 ? "$0" : max >= 10_000 ? `$${+(n / 1000).toFixed(1)}K` : `$${Math.round(n).toLocaleString("en-US")}`);
}
const full = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export type Column = { key: string; label: string; value: number; tooltip: ReactNode; current?: boolean };

/** Vertical columns from one baseline with a hover/focus tooltip on each. Values are dollars. */
export function ColumnChart({ columns, height = 180, caption }: { columns: Column[]; height?: number; caption: string }) {
  const max = niceMax(Math.max(...columns.map((c) => c.value)));
  const ticks = [0, max / 2, max];
  const compact = tickFormat(max);
  return (
    <figure className="pt-3">
      <div className="relative" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="w-11 shrink-0 -translate-y-1/2 text-right text-[11px] tabular-nums text-white/35">{compact(t)}</span>
            <span className="h-px flex-1 -translate-y-1/2 bg-white/[0.07]" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-[3.25rem] right-0 flex items-end">
          {columns.map((c, i) => (
            <div key={c.key} className="group relative flex h-full flex-1 items-end justify-center px-[1px]" tabIndex={0} aria-label={`${c.label}: ${full(c.value)}`}>
              <div
                className="w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-100 group-focus:opacity-100"
                style={{ height: `${(c.value / max) * 100}%`, minHeight: c.value > 0 ? 2 : 0, background: c.current ? COPPER : COPPER_MUTED }}
              />
              <div className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap ${
                  // Keep tooltips inside the card at either edge.
                  i < 2 ? "left-0" : i >= columns.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2"
                } rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-xs text-white/80 shadow-xl group-hover:block group-focus:block`}>
                {c.tooltip}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-[3.25rem] mt-2 flex">
        {columns.map((c, i) => (
          <span key={c.key} className={`flex-1 text-center text-[11px] ${c.current ? "font-semibold text-white/80" : "text-white/40"}`}>
            {/* Thin the labels on narrow charts: every other one past 8 columns. */}
            {columns.length <= 8 || i % 2 === columns.length % 2 ? c.label : ""}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

export type LinePoint = { key: string; label: string; value: number | null; tooltip: ReactNode };

/** A 2px line with an end marker and end label; gaps where a week had no shifts. */
export function LineChart({ points, height = 160, caption, format }: { points: LinePoint[]; height?: number; caption: string; format: (v: number) => string }) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  // Pad the range so the line doesn't hug the edges; it isn't a magnitude chart, so no zero baseline.
  const pad = Math.max((hi - lo) * 0.25, 1);
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 100;

  const segments: string[] = [];
  let current = "";
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current) segments.push(current);
      current = "";
    } else current += `${current ? "L" : "M"}${x(i)},${y(p.value)}`;
  });
  if (current) segments.push(current);
  const lastIndex = points.map((p) => p.value !== null).lastIndexOf(true);
  const last = lastIndex >= 0 ? points[lastIndex] : null;

  return (
    <figure>
      <div className="relative mr-14" style={{ height }}>
        {[min, (min + max) / 2, max].map((t) => (
          <span key={t} className="absolute inset-x-0 h-px bg-white/[0.07]" style={{ top: `${y(t)}%` }} />
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <path d={`${segments.join("")}`} fill="none" stroke={COPPER} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p, i) =>
          p.value === null ? null : (
            <div
              key={p.key}
              tabIndex={0}
              aria-label={`${p.label}: ${format(p.value)}`}
              className="group absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: `${x(i)}%`, top: `${y(p.value)}%` }}
            >
              <span
                className={`rounded-full ring-2 ring-[#1b1714] ${i === lastIndex ? "h-2.5 w-2.5" : "h-2 w-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100"}`}
                style={{ background: COPPER }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-xs text-white/80 shadow-xl group-hover:block group-focus:block">
                {p.tooltip}
              </div>
            </div>
          ),
        )}
        {last && last.value !== null && (
          <span className="absolute left-full ml-2 -translate-y-1/2 whitespace-nowrap text-sm font-semibold tabular-nums text-white" style={{ top: `${y(last.value)}%` }}>
            {format(last.value)}
          </span>
        )}
      </div>
      <div className="mr-14 mt-2 flex justify-between text-[11px] text-white/40">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

/** One whole split into two labelled parts (card vs cash), with a 2px surface gap. */
export function SplitBar({ parts }: { parts: { label: string; value: number; display: string; strong?: boolean }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.strong ? COPPER : "rgba(255,255,255,0.28)" }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.strong ? COPPER : "rgba(255,255,255,0.28)" }} />
            <span className="text-white/60">{p.label}</span>
            <span className="font-semibold tabular-nums text-white">{Math.round((p.value / total) * 100)}%</span>
            <span className="tabular-nums text-white/40">{p.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
