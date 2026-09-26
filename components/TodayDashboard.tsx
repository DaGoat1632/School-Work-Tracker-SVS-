"use client";

import Link from "next/link";
import { formatClock, formatDuration } from "@/lib/format";
import {
  buildSmartSchedule,
  detectScheduleConflicts,
  getCoachDayPlan,
} from "@/lib/planning";
import { useStore } from "@/lib/store";
import { addDays, formatDayLabel, startOfDay, toISODate } from "@/lib/time";

function toClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function rangeLabel(startMin: number, endMin: number): string {
  return `${formatClock(toClock(startMin))}–${formatClock(toClock(endMin))}`;
}

export function TodayDashboard() {
  const { state } = useStore();
  const now = new Date();
  const coach = getCoachDayPlan(state, now, now);
  const smart = buildSmartSchedule(state, now);
  const conflicts = detectScheduleConflicts(state, now);
  const todayKey = toISODate(now);

  const workAndBreaks = coach.items
    .filter((item) => item.kind === "work" || item.kind === "break")
    .sort((a, b) => a.startMin - b.startMin);
  const workItems = workAndBreaks.filter((item) => item.kind === "work");
  const lastWork = workItems[workItems.length - 1];
  const firstFocus = workAndBreaks[0];
  const freeAfter =
    lastWork &&
    coach.items
      .filter((item) => item.kind === "free" && item.startMin >= lastWork.endMin)
      .sort((a, b) => a.startMin - b.startMin)[0];

  const overdue = smart.plans.some((plan) => plan.track === "overdue");
  const atRisk = smart.plans.some((plan) => plan.track === "at_risk" || plan.shortBy > 0);
  const status = overdue
    ? { emoji: "🔴", text: "You’re running out of time" }
    : atRisk || conflicts.length > 0
      ? { emoji: "⚠️", text: "You have something to take care of" }
      : { emoji: "🟢", text: "You’re on track" };

  const upcoming = [...smart.plans]
    .filter((plan) => !plan.task.completed)
    .sort((a, b) => new Date(a.task.dueAt).getTime() - new Date(b.task.dueAt).getTime())
    .slice(0, 6);
  const tomorrowKey = toISODate(addDays(startOfDay(now), 1));
  const dueTomorrow = smart.plans.filter(
    (plan) => !plan.task.completed && toISODate(new Date(plan.task.dueAt)) === tomorrowKey,
  );

  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-4xl leading-none">Today 👋</h1>
        <p className="mt-2 text-[var(--ink-soft)]">What you should do next — not your whole calendar.</p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <Link href="/add/work" className="btn work">
          + Add work
        </Link>
        <Link href="/homework" className="btn ghost">
          Homework
        </Link>
      </section>

      <article className="card p-5">
        <h2 className="text-2xl">Here’s what you need to do</h2>

        {workItems.length > 0 && firstFocus && lastWork ? (
          <p className="mt-3 text-lg font-medium">
            🟢 {rangeLabel(firstFocus.startMin, lastWork.endMin)} — Best time to work
          </p>
        ) : freeAfter || coach.leftover ? (
          <p className="mt-3 text-lg font-medium">
            🟢 {rangeLabel((freeAfter ?? coach.leftover!).startMin, (freeAfter ?? coach.leftover!).endMin)} — Free
            time
          </p>
        ) : (
          <p className="mt-3 text-[var(--ink-soft)]">No work recommended for the rest of today.</p>
        )}

        {workAndBreaks.length > 0 && (
          <ul className="mt-4 space-y-2">
            {workAndBreaks.map((item) => (
              <li key={`${item.kind}-${item.startMin}-${item.title}`} className="text-lg">
                {rangeLabel(item.startMin, item.endMin)} {item.emoji}{" "}
                {item.kind === "break" ? "Break" : item.title}
              </li>
            ))}
          </ul>
        )}

        {dueTomorrow.length > 0 && (
          <div className="mt-4">
            <p className="font-medium">
              Due tomorrow
              {dueTomorrow.some((plan) =>
                plan.sessions.some((session) => session.dateKey === todayKey),
              )
                ? " — do this tonight"
                : ""}
            </p>
            <ul className="mt-2 space-y-1 text-[var(--ink-soft)]">
              {dueTomorrow.map((plan) => {
                const tonight = plan.sessions.filter((session) => session.dateKey === todayKey);
                const later = plan.sessions.filter((session) => session.dateKey !== todayKey);
                return (
                  <li key={plan.task.id}>
                    📌 {plan.task.title}
                    {tonight.length > 0
                      ? ` · tonight ${tonight.map((session) => session.label).join("; ")}`
                      : later.length > 0
                        ? ` · ${later.map((session) => session.label).join("; ")}`
                        : plan.planned === 0
                          ? " · not enough open time left"
                          : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {workItems.length > 0 && freeAfter && freeAfter.minutes >= 20 && (
          <p className="mt-4 text-lg font-medium">
            🟢 {rangeLabel(freeAfter.startMin, freeAfter.endMin)} — Free time
          </p>
        )}
      </article>

      <article className="card p-5">
        <h2 className="text-2xl">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-[var(--ink-soft)]">No open deadlines.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map((plan) => {
              const due = new Date(plan.task.dueAt);
              const dueLabel = formatDayLabel(due, now);
              const hasTodaySession = plan.sessions.some((session) => session.dateKey === todayKey);
              const mark =
                plan.track === "overdue"
                  ? "🔴"
                  : plan.track === "at_risk"
                    ? "🟠"
                    : plan.task.type === "quiz" || plan.task.type === "test"
                      ? "🟡"
                      : "📚";
              const statusBit =
                plan.track === "overdue"
                  ? "Overdue"
                  : plan.track === "at_risk"
                    ? "At risk"
                    : "On track";
              return (
                <li key={plan.task.id}>
                  <p className="font-medium">
                    {mark} {plan.task.title} — {dueLabel}
                  </p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {plan.track === "overdue" ? "🔴" : plan.track === "at_risk" ? "🟠" : "🟢"} {statusBit}
                    {plan.planned > 0 ? ` · ${formatDuration(plan.planned)} planned` : ""}
                    {hasTodaySession ? " · working on it today" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          Full session lists live on{" "}
          <Link href="/homework" className="font-medium" style={{ color: "var(--ink)" }}>
            Homework
          </Link>
          .
        </p>
      </article>

      <article className="card p-5" style={{ borderColor: "rgba(42, 106, 74, 0.35)" }}>
        <p className="text-2xl">
          {status.emoji} {status.text}
        </p>
      </article>
    </main>
  );
}
