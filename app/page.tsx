"use client";

import Link from "next/link";
import { NotificationCenter } from "@/components/NotificationCenter";
import { UpcomingDeadlines } from "@/components/UpcomingDeadlines";
import { EVENT_CATEGORIES, TASK_TYPES } from "@/lib/labels";
import { formatClock, formatDuration } from "@/lib/format";
import { useStore } from "@/lib/store";
import { formatDayLabel, formatDue } from "@/lib/time";
import { upcomingClasses, upcomingTests } from "@/lib/upcoming";

export default function HomePage() {
  const { state, generatePlan } = useStore();
  const tests = upcomingTests(state);
  const classes = upcomingClasses(state);
  const name = state.preferences.studentName || "there";

  return (
    <main className="space-y-5">
      <header>
        <p className="chip">Home</p>
        <h1 className="mt-2 text-4xl leading-none">Hey {name}</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Upcoming tests and classes in one place.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <Link href="/add/work" className="btn work">
          + Add work
        </Link>
        <Link href="/add/other" className="btn secondary">
          + Add class
        </Link>
        <Link href="/add/extracurricular" className="btn secondary">
          + Extracurricular
        </Link>
        <Link href="/add/sports" className="btn secondary">
          + Sports
        </Link>
        <button
          className="btn"
          onClick={generatePlan}
          disabled={state.tasks.length === 0 && state.events.length === 0}
        >
          {state.planReady ? "Rebuild plan" : "Generate plan"}
        </button>
      </section>

      <NotificationCenter />

      <UpcomingDeadlines />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl">Upcoming tests</h2>
              <p className="text-sm text-[var(--ink-soft)]">
                Quizzes and tests due in the next 4 weeks.
              </p>
            </div>
            <span className="chip">{tests.length}</span>
          </div>
          {tests.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">
              No upcoming tests. Add a quiz or test from Add work.
            </p>
          ) : (
            <ul className="space-y-3">
              {tests.map(({ task, due }) => (
                <li key={task.id} className="check-row">
                  <div
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: "var(--work)" }}
                  />
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-[var(--ink-soft)]">
                      {TASK_TYPES.find((item) => item.value === task.type)?.label}
                      {task.className ? ` · ${task.className}` : ""} · due{" "}
                      {formatDue(task.dueAt)} · {formatDuration(task.remainingMinutes)}{" "}
                      to prepare
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--work)]">
                      {formatDayLabel(due)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl">Upcoming classes</h2>
              <p className="text-sm text-[var(--ink-soft)]">
                School blocks coming up, including today if they haven’t ended.
              </p>
            </div>
            <span className="chip">{classes.length}</span>
          </div>
          {classes.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">
              No classes on the calendar. Add school hours from Other.
            </p>
          ) : (
            <ul className="space-y-3">
              {classes.slice(0, 18).map(({ event, start, end }) => (
                <li key={`${event.id}-${start.toISOString()}`} className="check-row">
                  <div
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: "var(--school)" }}
                  />
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-[var(--ink-soft)]">
                      {EVENT_CATEGORIES.find((item) => item.value === event.category)
                        ?.label}{" "}
                      · {formatDayLabel(start)} · {formatClock(start)} –{" "}
                      {formatClock(end)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
