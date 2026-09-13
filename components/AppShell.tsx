"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { conflictCount } from "@/lib/plan";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/schedule/today", label: "Today", icon: "📅" },
  { href: "/schedule/tomorrow", label: "Tomorrow", icon: "🗓" },
  { href: "/schedule/week", label: "This week", icon: "▦" },
  { href: "/schedule/next-week", label: "Next week", icon: "▣" },
  { href: "/schedule/month", label: "Next month", icon: "📆" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, hydrated } = useStore();
  const conflicts = conflictCount(state);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="px-2 pb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-10 w-10 place-items-center rounded-2xl text-lg font-bold text-[#fff4ec]"
              style={{ background: "var(--work)" }}
            >
              S
            </div>
            <div>
              <p className="display text-2xl leading-none">Stride</p>
              <p className="text-xs text-[var(--ink-soft)]">Your schedule</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav flex flex-col gap-1.5 px-1">
          {NAV.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link ${active ? "active" : ""}`}
              >
                <span className="sidebar-icon" aria-hidden>
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 px-1">
          {conflicts > 0 && (
            <div className="conflict-pill">
              ⚠ {conflicts} time conflict{conflicts === 1 ? "" : "s"}
            </div>
          )}
          <Link
            href="/settings"
            className={`sidebar-link ${pathname.startsWith("/settings") ? "active" : ""}`}
          >
            <span className="sidebar-icon" aria-hidden>
              ⚙
            </span>
            <span>Settings</span>
          </Link>
        </div>
      </aside>
      <div className="main">
        {hydrated ? children : <p className="text-[var(--ink-soft)]">Loading…</p>}
      </div>
    </div>
  );
}
