"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, MotionConfig, useReducedMotion } from "framer-motion";

/**
 * Makes every framer-motion animation honour the device's "Reduce motion" setting.
 * (The CSS rule in globals.css only covers CSS transitions; framer-motion runs in JS.)
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/**
 * A number that rolls to its new value instead of snapping. Text is written straight to the DOM
 * so a 60fps tween doesn't re-render React. With reduced motion it just shows the value.
 */
export function CountUp({
  value,
  format,
  from,
  duration = 0.9,
  className,
}: {
  value: number;
  format: (n: number) => string;
  /** Where the first roll starts. Leave unset to show the first value as-is. */
  from?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // React only renders the starting text; after that the effect owns the span's text, and since
  // this string never changes React never overwrites it.
  const [start] = useState(() => from ?? value);
  const shown = useRef(start);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || shown.current === value) {
      shown.current = value;
      el.textContent = format(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => {
        shown.current = n;
        el.textContent = format(n);
      },
    });
    return () => controls.stop();
  }, [value, format, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(start)}
    </span>
  );
}

/** Shakes an element sideways, the universal "nope". Skipped with reduced motion. */
export function useShake<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();
  const shake = () => {
    if (!ref.current || reduce) return;
    animate(ref.current, { x: [0, -7, 7, -5, 5, -2, 0] }, { duration: 0.42, ease: "easeOut" });
  };
  return [ref, shake] as const;
}

const SUITS = ["♠", "♥", "♦", "♣"];

/**
 * A tiny burst of card suits and copper sparks behind the total when a cash-out lands.
 * Decorative only: hidden from screen readers and skipped with reduced motion.
 */
export function SuitBurst({ trigger }: { trigger: string | number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div key={trigger} className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + 0.3;
        const dist = 90 + (i % 3) * 26;
        const suit = i % 3 === 0;
        return (
          <motion.span
            key={i}
            className={suit ? `absolute text-sm ${i % 2 ? "text-rose-300/80" : "text-white/70"}` : "absolute h-1.5 w-1.5 rounded-full bg-copper-light"}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist * 0.55,
              opacity: [0, 1, 0],
              scale: [0.4, 1, 0.8],
              rotate: suit ? (i % 2 ? 40 : -40) : 0,
            }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 + (i % 4) * 0.03 }}
          >
            {suit ? SUITS[(i / 3) % 4] : null}
          </motion.span>
        );
      })}
    </div>
  );
}
