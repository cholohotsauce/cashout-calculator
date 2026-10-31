"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteShiftAction } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-rose-500/90 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Confirm delete"}
    </button>
  );
}

/** Two taps to delete, without a browser dialog; the confirm step times out on its own. */
export function DeleteShiftButton({ id }: { id: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-full px-3 py-1.5 text-sm text-white/45 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
      >
        Delete shift
      </button>
    );
  }
  return (
    <form action={deleteShiftAction}>
      <input type="hidden" name="id" value={id} />
      <Submit />
    </form>
  );
}
