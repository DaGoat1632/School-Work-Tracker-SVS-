"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { formatDue } from "@/lib/time";

export default function HomeworkPage() {
  const { state, removeTask, updateTask } = useStore();

  return (
    <main className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Homework</h1>
          <p className="mt-2 text-[var(--ink-soft)]">
            Everything you have submitted. Generate a plan on Weekly when ready.
          </p>
        </div>
        <Link href="/add/work" className="btn work">
          + Add work
        </Link>
      </header>
      <section className="space-y-3">
        {state.tasks.length === 0 && (
          <div className="card p-6 text-[var(--ink-soft)]">No work yet.</div>
        )}
        {state.tasks.map((task) => (
          <article key={task.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="chip">{task.type}</p>
                <h3 className="mt-2 text-2xl">{task.title}</h3>
                <p className="text-sm text-[var(--ink-soft)]">
                  {task.className ? `${task.className} · ` : ""}
                  {task.difficulty} · {task.remainingMinutes}/{task.estimatedMinutes}m
                  · due {formatDue(task.dueAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {!task.completed && (
                  <button
                    className="btn secondary"
                    onClick={() =>
                      updateTask(task.id, {
                        remainingMinutes: 0,
                        completed: true,
                      })
                    }
                  >
                    Finish
                  </button>
                )}
                <button className="btn ghost" onClick={() => removeTask(task.id)}>
                  Remove
                </button>
              </div>
            </div>
            {task.completed && (
              <p className="mt-2 text-sm" style={{ color: "var(--ok)" }}>
                Completed
              </p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
