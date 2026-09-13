"use client";

import { formatClock, formatDuration } from "@/lib/format";
import {
  buildSmartSchedule,
  formatConflictMessage,
  getCoachDayPlan,
  todayInsights,
} from "@/lib/planning";
import { useStore } from "@/lib/store";
import { formatDue } from "@/lib/time";

function toClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function trackLabel(track: string): string {
  if (track === "overdue") return "🔴 Overdue";
  if (track === "at_risk") return "🟠 At risk";
  if (track === "needs_planning") return "🟡 Needs planning";
  return "🟢 On track";
}

export function TodayDashboard() {
  const { state } = useStore();
  const insights = todayInsights(state);
  const coach = getCoachDayPlan(state, new Date());
  const smart = buildSmartSchedule(state);
  const workItems = coach.items.filter((item) => item.kind === "work");
  const leftover = coach.leftover;

  return (
    <section className="space-y-3">
      <h2 className="text-2xl">Today</h2>

      <article className="card p-5" style={{ borderColor: "rgba(42, 106, 74, 0.35)" }}>
        <p className="chip">Tonight</p>
        <h3 className="mt-2 text-2xl">🟢 {coach.headline}</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="chip">📝 {formatDuration(coach.workMinutes)} planned work</span>
          <span className="chip">🟢 {formatDuration(coach.freeMinutes)} free time</span>
          {coach.urgentCount > 0 && (
            <span className="chip">⚠️ {coach.urgentCount} urgent</span>
          )}
          {coach.testCount > 0 && (
            <span className="chip">📚 {coach.testCount} upcoming test{coach.testCount === 1 ? "" : "s"}</span>
          )}
        </div>
      </article>

      <article className="card p-5">
        <h3 className="text-lg">Your plan</h3>
        {coach.items.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-soft)]">Nothing left to plan today.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {coach.items.map((item) => (
              <li key={`${item.kind}-${item.startMin}-${item.title}`}>
                <p className="font-medium">
                  {formatClock(toClock(item.startMin))}–{formatClock(toClock(item.endMin))}
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {item.emoji} {item.kind === "break" ? <strong>{item.title}</strong> : item.title}
                  {item.kind === "work" ? ` · ${formatDuration(item.minutes)}` : ""}
                  {item.kind === "free" ? ` · ${formatDuration(item.minutes)}` : ""}
                  {item.kind === "personal" ? ` · ${formatDuration(item.minutes)}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
        {leftover && leftover.minutes >= 20 && workItems.length > 0 && (
          <p className="mt-4 text-sm font-medium">
            After that, {leftover.emoji} {formatClock(toClock(leftover.startMin))}–
            {formatClock(toClock(leftover.endMin))} is completely free.
          </p>
        )}
      </article>

      {insights.conflicts.length > 0 && (
        <div className="warn-card whitespace-pre-line">
          <strong>
            ⚠️ {insights.conflicts.length} schedule conflict
            {insights.conflicts.length === 1 ? "" : "s"}
          </strong>
          {insights.conflicts.slice(0, 3).map((hit) => (
            <p key={`${hit.dateKey}-${hit.right.id}`} className="mt-2 text-sm">
              {formatConflictMessage(hit)}
            </p>
          ))}
        </div>
      )}

      <article className="card p-5">
        <h3 className="text-lg">Recommended plan</h3>
        <p className="mt-1 mb-3 text-sm text-[var(--ink-soft)]">
          Only the work that needs to happen — with breaks, and real free time left over.
        </p>
        <ul className="space-y-4">
          {smart.plans.length === 0 && (
            <li className="text-sm text-[var(--ink-soft)]">No open assignments.</li>
          )}
          {smart.plans.map((plan) => (
            <li key={plan.task.id}>
              <p className="font-medium">{plan.task.title}</p>
              <p className="text-sm text-[var(--ink-soft)]">
                {trackLabel(plan.track)} · Required {formatDuration(plan.needed)} · Scheduled{" "}
                {formatDuration(plan.planned)} · Remaining {formatDuration(plan.remaining)} ·{" "}
                {formatDue(plan.task.dueAt)}
              </p>
              {plan.track === "at_risk" && plan.shortBy > 0 && (
                <div className="mt-2 text-sm" style={{ color: "var(--warn)" }}>
                  <p>🚨 At risk</p>
                  <p>You need: {formatDuration(plan.needed)}</p>
                  <p>Available: {formatDuration(plan.availableBeforeDeadline)}</p>
                  <p>Short by: {formatDuration(plan.shortBy)}</p>
                </div>
              )}
              {plan.track === "needs_planning" && plan.remaining > 0 && (
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  {formatDuration(plan.remaining)} still needs a spot on the calendar, and there is
                  enough time before the deadline to fit it.
                </p>
              )}
              <ul className="mt-1 space-y-1 text-sm text-[var(--ink-soft)]">
                {plan.sessions.map((session) => (
                  <li key={`${session.dateKey}-${session.startMin}`}>
                    {session.date.toLocaleDateString([], { weekday: "long" })} {session.label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
