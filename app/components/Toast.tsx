"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type ToastTone = "info" | "success" | "error";
type ToastState = { id: number; message: string; tone: ToastTone } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, show, dismiss };
}

const DOT: Record<ToastTone, string> = {
  info: "bg-white/70",
  success: "bg-emerald-400",
  error: "bg-rose-400",
};

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-32 z-[60] flex justify-center px-4"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            role={toast.tone === "error" ? "alert" : "status"}
            className="flex items-center gap-3 rounded-full border border-white/10 bg-neutral-900/90 px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-xl"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[toast.tone]}`} />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
