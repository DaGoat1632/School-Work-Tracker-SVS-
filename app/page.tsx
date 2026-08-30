"use client";

import { TaskForm } from "@/components/TaskForm";
import { WarningList } from "@/components/WarningList";
import { TodayTimeline } from "@/components/TodayTimeline";
import { useStore } from "@/lib/store";
import { formatDue } from "@/lib/time";

export default function TodayPage() {
  const { state, hydrated } = useStore();
  const openTasks = state.tasks.filter((task) => !task.completed);
  const remaining = openTasks.reduce((sum, task) => sum + task.remainingMinutes, 0);
  const planned = state.blocks
    .filter((block) => block.status === "planned")
    .reduce((sum, block) => sum + block.minutes, 0);

  return (
    <main>
      <WarningList />
      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <Stat label="Open work" value={`${openTasks.length} tasks`} />
        <Stat label="Minutes left" value={`${remaining}m`} />
        <Stat label="On the calendar" value={`${planned}m planned`} />
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-3xl">Today</h2>
            <p className="text-sm text-[var(--ink-soft)]">
              {hydrated && state.lastPlannedAt
                ? `Last rebuilt ${new Date(state.lastPlannedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : "Building the week…"}
            </p>
          </div>
          <TodayTimeline />
        </section>
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-2xl">Still open</h2>
            <ul className="mt-3 space-y-3">
              {openTasks.length === 0 && (
                <li className="text-sm text-[var(--ink-soft)]">Caught up.</li>
              )}
              {openTasks.map((task) => (
                <li key={task.id}>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {task.className ? `${task.className} · ` : ""}
                    {task.remainingMinutes}m left · due {formatDue(task.dueAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <TaskForm />
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
        {label}
      </p>
      <p className="display mt-1 text-3xl">{value}</p>
    </div>
  );
}
