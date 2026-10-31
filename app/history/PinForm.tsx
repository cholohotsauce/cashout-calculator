"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";

export function PinForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="pin" className="mb-2 block text-sm font-medium text-white/55">
          Manager PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "pin-error" : undefined}
          className={`h-14 w-full rounded-2xl border bg-black/25 px-4 text-center text-2xl font-medium tracking-[0.4em] text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] placeholder:text-white/25 focus:bg-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${
            state.error ? "border-rose-400/70" : "border-white/5 focus:border-white/20"
          }`}
        />
        {state.error && (
          <p id="pin-error" className="mt-3 text-sm text-rose-300">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-14 w-full rounded-[20px] bg-white/90 text-lg font-semibold text-black shadow-[0_0_18px_rgba(255,255,255,0.15)] transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
      >
        {pending ? "Checking…" : "Unlock history"}
      </button>
    </form>
  );
}
