"use client";

import { deleteShiftAction } from "../actions";
import { ConfirmAction } from "./ConfirmAction";

export function DeleteShiftButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      action={deleteShiftAction}
      fields={{ id }}
      label="Delete shift"
      confirmLabel="Confirm delete"
      pendingLabel="Deleting…"
      tone="danger"
      className="px-3! py-1.5! font-normal!"
    />
  );
}
