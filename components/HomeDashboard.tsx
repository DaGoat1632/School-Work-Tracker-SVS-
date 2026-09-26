"use client";

import Link from "next/link";
import { formatClockRange } from "@/lib/format";
import {
  compactTodaySchedule,
  homeConflicts,
  homeLoad,
  studyStreak,
  tonightWindow,
  upcomingDeadlineRows,
  weekTaskStats,
} from "@/lib/overview";
import { useStore } from "@/lib/store";

export function HomeDashboard() {
  const { state } = useStore();
  const now = new Date();
  const tonight = tonightWindow(state, now);
  const tasks = weekTaskStats(state, now);
  const load = homeLoad(state);
  const streak = studyStreak(state, now);
  const deadlines = upcomingDeadlineRows(state, now, 6);
  const today = compactTodaySchedule(state, now);
  const conflicts = homeConflicts(state, now);
  const urgentCount = deadlines.filter((row) => row.badge === "Urgent").length;

  return (
    <div className="space-y-4">
      <section className="stat-grid">
        <article className="card stat-card p-4">
          <p className="label">Free tonight</p>
          <p className="value">{tonight.hoursLabel}</p>
          <p className="range">{tonight.rangeLabel}</p>
        </article>
        <article className="card stat-card p-4">
          <p className="label">Tasks this week</p>
          <p className="value">{tasks.count}</p>
          <p className="hint">{tasks.urgent} urgent</p>
        </article>
        <article className="card stat-card p-4">
          <p className="label">Week load</p>
          <p className="value">{load.label}</p>
        </article>
        <article className="card stat-card p-4">
          <p className="label">Streak</p>
          <p className="value">
            {streak} {streak === 1 ? "day" : "days"}
          </p>
          <p className="hint">{streak > 0 ? "Keep the quiet rhythm." : "Start with one block tonight."}</p>
        </article>
      </section>

      {conflicts.length > 0 && (
        <section className="space-y-2">
          {conflicts.map((item) => (
            <div key={item.id} className="home-warn">
              ⚠ {item.text}
            </div>
          ))}
        </section>
      )}

      <section className="hero">
        <div>
          <p className="kicker">You are free between :</p>
          <p className="window">{tonight.rangeLabel}</p>
          <p className="text-sm" style={{ opacity: 0.9 }}>
            {tonight.heroLine}
          </p>
        </div>
        <div className="hero-pill">{tonight.hoursLabel} free</div>
      </section>

      <section className="home-split">
        <article className="card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg">Upcoming deadlines</h2>
            {urgentCount > 0 && <span className="badge-count">{urgentCount} urgent</span>}
          </div>
          {deadlines.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">No open deadlines.</p>
          ) : (
            <ul className="space-y-3">
              {deadlines.map((row) => (
                <li key={row.task.id} className="flex items-start gap-3">
                  <span
                    className={`dot mt-1.5 ${row.badge === "Urgent" ? "urgent" : row.badge === "Soon" ? "soon" : "ok"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{row.task.title}</p>
                    {row.dueToday ? (
                      <p className="text-xs" style={{ color: "#E24B4A" }}>
                        {row.task.title} — due today
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--ink-soft)]">{row.neededLabel}</p>
                    )}
                  </div>
                  <span className="text-sm text-[var(--ink-soft)]">{row.daysLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card p-5">
          <h2 className="mb-3 text-lg">Today&apos;s schedule</h2>
          {today.length === 0 ? (
            <div className="text-sm text-[var(--ink-soft)]">
              <p>Add your activities to see today&apos;s schedule</p>
              <Link href="/activities" className="mt-2 inline-block text-sm" style={{ color: "var(--orange)" }}>
                + Add activity
              </Link>
            </div>
          ) : (
            <ul>
              {today.map((item) => (
                <li key={item.id} className="schedule-row">
                  <span className={`bar ${item.tone}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{item.title}</p>
                    <p className="text-xs text-[var(--ink-soft)]">
                      {formatClockRange(item.startMin, item.endMin)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
