"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { StudyPlanModal } from "@/components/StudyPlanModal";
import { isExamType } from "@/lib/freeWindows";
import { planHoursForTask } from "@/lib/requestStudyPlan";
import { useStore } from "@/lib/store";
import { formatDue } from "@/lib/time";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, addPlanToSchedule, saveAiPlan, updateStudySession } = useStore();
  const task = state.tasks.find((item) => item.id === params.id);
  const sessions = state.studySessions.filter((session) => session.taskId === params.id);
  const [busy, setBusy] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  if (!task) {
    return (
      <div className="card p-5 text-sm text-[var(--ink-soft)]">
        Task not found. <Link href="/homework">Back to homework</Link>
      </div>
    );
  }

  async function regenerate() {
    if (!task) return;
    setBusy(true);
    try {
      const result = await planHoursForTask({
        task,
        events: state.events,
        studySessions: state.studySessions,
      });
      if (result.noWindows || !result.plan) return;
      saveAiPlan(task.id, result.plan);
      setShowPlan(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--ink-soft)]">
        {task.className || "General"} · Due {formatDue(task.dueAt)}
        {isExamType(task.type) ? " · 2h prep" : ""}
      </p>

      {task.aiPlan ? (
        <button type="button" className="btn work" onClick={() => setShowPlan(true)}>
          View plan
        </button>
      ) : (
        <div className="card p-5 text-sm text-[var(--ink-soft)]">
          No study plan yet.
          <button type="button" className="btn work mt-3 block" onClick={regenerate} disabled={busy}>
            {busy ? "Building your plan..." : "Plan it"}
          </button>
        </div>
      )}

      {sessions.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg">Sessions</h2>
          <ul className="mt-3 space-y-3">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="round-check"
                  checked={session.completed}
                  onChange={() =>
                    updateStudySession(session.id, { completed: !session.completed, skipped: false })
                  }
                  aria-label={`Mark ${session.focus} done`}
                />
                <div>
                  <p className="text-sm">
                    {session.day} {session.startTime} – {session.endTime}
                  </p>
                  <p className="text-xs text-[var(--ink-soft)]">{session.focus}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {task.aiPlan && (
        <button type="button" className="btn secondary" onClick={regenerate} disabled={busy}>
          {busy ? "Building your plan..." : "Regenerate plan"}
        </button>
      )}

      {showPlan && task.aiPlan && (
        <StudyPlanModal
          task={task}
          plan={task.aiPlan}
          onAdd={task.planAddedToSchedule ? undefined : () => addPlanToSchedule(task.id)}
          onClose={() => setShowPlan(false)}
        />
      )}
    </div>
  );
}
