import Link from "next/link";
import type { ReactNode } from "react";
import { Backdrop } from "../components/Backdrop";
import { logoutAction } from "../actions";

export function Panel({ title, aside, children, className = "" }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-xl backdrop-blur-3xl sm:p-6 ${className}`}>
      {title && (
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-white/90">{title}</h2>
          {aside && <div className="ml-auto text-sm text-white/45">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const SECTIONS = [
  { key: "history", href: "/history", label: "Payday & history" },
  { key: "trends", href: "/history/trends", label: "Trends" },
  { key: "log", href: "/history/log", label: "Change log" },
  { key: "settings", href: "/history/settings", label: "Staff & settings" },
] as const;
export type Section = (typeof SECTIONS)[number]["key"];

/** Page frame for the manager area: back to the calculator, section links, and Lock. */
export function Shell({ children, section, signedIn = false, title = "Shift History" }: { children: ReactNode; section?: Section; signedIn?: boolean; title?: string }) {
  return (
    <div className="relative min-h-screen bg-black pb-16 font-sans selection:bg-copper/40">
      <Backdrop />
      <main className="relative z-10 mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-8">
        <header className="flex items-center justify-between pb-1 pt-4">
          <Link href="/" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z" clipRule="evenodd" />
            </svg>
            Calculator
          </Link>
          <h1 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">{title}</h1>
          {signedIn ? (
            <form action={logoutAction}>
              <button type="submit" className="rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                Lock
              </button>
            </form>
          ) : (
            <span className="w-[84px]" />
          )}
        </header>
        {signedIn && section && (
          <nav aria-label="Manager sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {SECTIONS.map((s) => (
              <Link
                key={s.key}
                href={s.href}
                aria-current={s.key === section ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  s.key === section ? "bg-copper/25 font-semibold text-copper-light ring-1 ring-copper/40" : "text-white/55 hover:bg-white/10 hover:text-white"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}
