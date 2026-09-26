"use client";

import Link from "next/link";
import type { AiStudyPlan, Task } from "@/lib/types";
import { isExamType } from "@/lib/freeWindows";

function dueDay(task: Task): string {
  return new Date(task.dueAt).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function StudyPlanOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="plan-overlay" role="dialog" aria-modal="true">
      <button type="button" className="plan-overlay-bg" aria-label="Close" onClick={onClose} />
      <div className="plan-overlay-card">{children}</div>
    </div>
  );
}

export function StudyPlanModal({
  task,
  plan,
  onAdd,
  onClose,
}: {
  task: Task;
  plan: AiStudyPlan;
  onAdd?: () => void;
  onClose: () => void;
}) {
  const exam = isExamType(task.type);
  const subject = task.className || "General";

  return (
    <StudyPlanOverlay onClose={onClose}>
      <div className="plan-card">
        <div className="plan-modal-head">
          <p className="plan-modal-kicker">Your study plan is ready</p>
          <p className="plan-modal-sub">
            {task.title} · {subject} · due {dueDay(task)}
          </p>
        </div>
        <div className="p-5">
          {plan.warningMessage && <div className="home-warn mb-3">⚠ {plan.warningMessage}</div>}

          <ul>
            {plan.plan.map((session, index) => (
              <li key={`${session.dateKey ?? session.date}-${index}`} className="session-card">
                <p className="session-when">
                  {session.day} {session.date}
                </p>
                <p className="session-clock">
                  {session.startTime} – {session.endTime}
                  {session.duration ? ` · ${session.duration}` : ""}
                </p>
                <p className="session-focus">{session.focus}</p>
                {session.tip && <p className="session-tip">Tip: {session.tip}</p>}
              </li>
            ))}
          </ul>

          {exam && (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">Night before: Rest — you&apos;re prepared.</p>
          )}
          {plan.encouragement && <p className="plan-encourage">{plan.encouragement}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            {onAdd && (
              <button type="button" className="btn work" onClick={onAdd}>
                Add to my schedule
              </button>
            )}
            <button type="button" className="btn secondary" onClick={onClose}>
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </StudyPlanOverlay>
  );
}

export function NoFreeTimeModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <StudyPlanOverlay onClose={onClose}>
      <div className="plan-card p-5">
        <p className="text-lg">Task saved</p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{task.title} is in your homework list</p>
        <div className="home-warn mt-4">⚠ No free time found before this deadline</div>
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          You have activities every evening before {dueDay(task)}. To make time:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-[var(--ink-soft)]">
          <li>· Remove an activity on the Activities page</li>
          <li>· Ask your teacher for more time</li>
          <li>· Study during lunch or free periods</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/activities" className="btn work" onClick={onClose}>
            Go to Activities
          </Link>
          <button type="button" className="btn secondary" onClick={onClose}>
            OK, got it
          </button>
        </div>
      </div>
    </StudyPlanOverlay>
  );
}

export function PlanFallbackModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <StudyPlanOverlay onClose={onClose}>
      <div className="plan-card p-5 text-center">
        <p className="fallback-check" aria-hidden>
          ✓
        </p>
        <p className="text-lg">Task saved!</p>
        <p className="mt-1 text-sm">{task.title} added to your homework list</p>
        <p className="mt-2 text-xs text-[var(--ink-soft)]">Open Homework to plan it</p>
        <Link href="/homework" className="btn work mt-5 inline-block" onClick={onClose}>
          Go to Homework
        </Link>
      </div>
    </StudyPlanOverlay>
  );
}

