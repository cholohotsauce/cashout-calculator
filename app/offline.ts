"use client";

import type { SaveInput } from "./actions";

// Cash-outs saved while the iPad has no signal wait here, keyed by shift id, until they upload.
// A later save of the same shift replaces the queued one, so only the latest version is sent.
const QUEUE_KEY = "ace:pending-saves";
const DRAFT_KEY = "ace:draft";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: nothing more we can do on the device.
  }
}

export type Pending = Record<string, SaveInput>;

export const pendingSaves = () => read<Pending>(QUEUE_KEY, {});

export function queueSave(input: SaveInput) {
  write(QUEUE_KEY, { ...pendingSaves(), [input.id]: input });
}

export function dropSave(id: string) {
  const rest = { ...pendingSaves() };
  delete rest[id];
  write(QUEUE_KEY, Object.keys(rest).length ? rest : null);
}

/** A thrown fetch (as opposed to a server reply) means the request never got through. */
export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export type Draft = {
  shiftDate: string;
  cashTips: string;
  cardTips: string;
  selectedStaff: string[];
  staffHours: Record<string, string>;
  extraName: string;
  shiftId: string | null;
};

export const loadDraft = () => read<Draft | null>(DRAFT_KEY, null);
export const saveDraft = (d: Draft | null) => write(DRAFT_KEY, d);
