"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

const TONES = {
  danger: {
    idle: "text-white/45 hover:bg-rose-500/10 hover:text-rose-300",
    armed: "bg-rose-500/90 text-white hover:bg-rose-500",
  },
  primary: {
    idle: "bg-white/90 text-black hover:bg-white",
    armed: "bg-emerald-400 text-black hover:bg-emerald-300",
  },
  quiet: {
    idle: "text-white/50 hover:bg-white/10 hover:text-white",
    armed: "bg-white/15 text-white hover:bg-white/25",
  },
};

function Submit({ className, children, pendingLabel }: { className: string; children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * A server action behind two taps, without a browser dialog. The first tap arms it,
 * the second runs it; it disarms on its own after a few seconds.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  confirmLabel,
  pendingLabel = "Working…",
  tone = "quiet",
  className = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const base = `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${className}`;
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={`${base} ${TONES[tone].idle}`}>
        {label}
      </button>
    );
  }
  return (
    <form action={action} onSubmit={() => setTimeout(() => setArmed(false), 0)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Submit className={`${base} ${TONES[tone].armed}`} pendingLabel={pendingLabel}>
        {confirmLabel}
      </Submit>
    </form>
  );
}
