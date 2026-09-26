"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconActivity,
  IconBell,
  IconCalendar,
  IconGear,
  IconHome,
  IconList,
  IconMic,
  IconWeek,
} from "@/components/Icons";
import { useStore } from "@/lib/store";
import { addDays, startOfWeek } from "@/lib/time";

const NAV = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/schedule/week", label: "This week", icon: IconWeek },
  { href: "/schedule/month", label: "This month", icon: IconCalendar },
  { href: "/homework", label: "Homework", icon: IconList },
  { href: "/activities", label: "Activities", icon: IconActivity },
  { href: "/reminders", label: "Reminders", icon: IconBell },
  { href: "/settings", label: "Settings", icon: IconGear },
];

function pageCopy(pathname: string, name: string) {
  const date = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  if (pathname === "/") return { title: `Hey ${name}`, subtitle: date };
  if (pathname.startsWith("/schedule/month")) {
    const month = new Date().toLocaleDateString([], { month: "long", year: "numeric" });
    return {
      title: "This month",
      subtitle: `${month} · activities, sports, and study sessions`,
    };
  }
  if (pathname.startsWith("/schedule/week")) {
    const start = startOfWeek(new Date());
    const end = addDays(start, 6);
    const left = start.toLocaleDateString([], { month: "short", day: "numeric" });
    const right = end.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    return {
      title: "This week",
      subtitle: `${left} – ${right} · activities, sports, and homework together`,
    };
  }
  if (pathname.startsWith("/homework/") && pathname !== "/homework") {
    return { title: "Task", subtitle: "Sessions, checkboxes, and a fresh plan if the week changed." };
  }
  if (pathname.startsWith("/homework")) {
    return { title: "Homework", subtitle: "Urgent work first. Everything else can wait." };
  }
  if (pathname.startsWith("/activities")) {
    return { title: "Activities", subtitle: "Sports, clubs, and repeating blocks." };
  }
  if (pathname.startsWith("/reminders")) {
    return { title: "Reminders", subtitle: "Only what still needs a look." };
  }
  if (pathname.startsWith("/settings")) {
    return { title: "Settings", subtitle: "Name, sleep, and work limits." };
  }
  if (pathname.startsWith("/add/work")) {
    return { title: "Add task", subtitle: "Name it, pick a due day, save." };
  }
  if (pathname.startsWith("/add/")) {
    return { title: "Add activity", subtitle: "Fixed time the week has to work around." };
  }
  return { title: "Schedi", subtitle: date };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, hydrated } = useStore();
  const name = state.preferences.studentName || "there";
  const copy = pageCopy(pathname, name);
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="flex items-center gap-2.5 px-1">
          <div
            className="grid h-9 w-9 place-items-center rounded-[10px] text-sm text-[#fff7f0]"
            style={{ background: "var(--orange)" }}
          >
            S
          </div>
          <p className="text-lg leading-none">Schedi</p>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((link) => {
            const Icon = link.icon;
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
                <span className="sidebar-icon">
                  <Icon />
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link href="/add/work" className="voice-btn mt-auto">
          <span className="sidebar-icon mt-0.5" style={{ color: "var(--orange)" }}>
            <IconMic />
          </span>
          <span className="text-sm leading-snug">Say it — add anything by voice</span>
        </Link>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <h1>{copy.title}</h1>
            <p className="sub">{copy.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/add/work" className="btn work">
              + Add task
            </Link>
            <div className="avatar" aria-hidden>
              {initial}
            </div>
          </div>
        </header>
        <div className="main">
          {hydrated ? children : <p className="text-[var(--ink-soft)]">Loading…</p>}
        </div>
      </div>
    </div>
  );
}
