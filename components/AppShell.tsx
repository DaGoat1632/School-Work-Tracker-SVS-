"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/work", label: "Work" },
  { href: "/life", label: "Life" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useStore().hydrated;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="chip">Student planner</p>
          <h1 className="mt-3 text-4xl leading-none md:text-5xl">Stride</h1>
          <p className="mt-2 max-w-xl text-[0.95rem] text-[var(--ink-soft)]">
            Dump the week in. The scheduler spreads projects, protects sports and
            sleep, and rebuilds the plan when you miss a block.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  active
                    ? "bg-[var(--ink)] text-[#f7efe3]"
                    : "border border-[var(--line)] bg-[#fffaf3]/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {hydrated ? children : <p className="text-[var(--ink-soft)]">Loading your week…</p>}
    </div>
  );
}
