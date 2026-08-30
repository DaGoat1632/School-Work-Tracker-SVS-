"use client";

import { TaskForm } from "@/components/TaskForm";
import { useStore } from "@/lib/store";
import { formatDue } from "@/lib/time";

export default function WorkPage() {
  const { state, removeTask, updateTask } = useStore();

  return (
    <main className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <TaskForm />
      <section className="space-y-3">
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
                      updateTask(task.id, { remainingMinutes: 0, completed: true })
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
              <p className="mt-2 text-sm text-[var(--ok)]">Completed</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
