"use client";

import Link from "next/link";
import { useState } from "react";
import { StudyPlanModal } from "@/components/StudyPlanModal";
import { formatHoursShort } from "@/lib/format";
import { hoursForTask } from "@/lib/placeStudyPlan";
import { homeworkBadge } from "@/lib/overview";
import { createTaskPlan } from "@/lib/planning";
import { planHoursForTask } from "@/lib/requestStudyPlan";
import { useStore } from "@/lib/store";
import { formatDue } from "@/lib/time";
import type { Difficulty, Task, TaskPriority } from "@/lib/types";

const HOUR_OPTIONS = [
  { label: "0.5h", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "4h", minutes: 240 },
  { label: "5h", minutes: 300 },
  { label: "6h+", minutes: 360 },
];

function hoursNeeded(task: Task): string {
  return formatHoursShort(Math.round(hoursForTask(task) * 60));
}

function selectedHourMinutes(minutes: number): number {
  if (minutes >= 360) return 360;
  return HOUR_OPTIONS.reduce((best, option) =>
    Math.abs(option.minutes - minutes) < Math.abs(best.minutes - minutes) ? option : best,
  ).minutes;
}

function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden>
      <path
        d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L8.999 12v3h3l8.386-8.415Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m16 5 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TaskEditForm({
  task,
  onCancel,
  onSave,
}: {
  task: Task;
  onCancel: () => void;
  onSave: (patch: Partial<Task>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [className, setClassName] = useState(task.className);
  const [dueAt, setDueAt] = useState(toDateTimeLocal(task.dueAt));
  const [minutes, setMinutes] = useState(selectedHourMinutes(task.estimatedMinutes));
  const [difficulty, setDifficulty] = useState<Difficulty>(task.difficulty);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);

  function save() {
    if (!title.trim() || !dueAt) return;
    onSave({
      title: title.trim(),
      className: className.trim(),
      dueAt: new Date(dueAt).toISOString(),
      estimatedMinutes: minutes,
      remainingMinutes: minutes,
      difficulty,
      priority,
    });
  }

  return (
    <form
      className="hw-edit-form"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label className="hw-field">
        <span>Task name</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="hw-field">
        <span>Subject</span>
        <input value={className} onChange={(event) => setClassName(event.target.value)} />
      </label>
      <label className="hw-field">
        <span>Due</span>
        <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </label>
      <div className="hw-field">
        <span>Difficulty</span>
        <div className="hw-hours">
          {(["easy", "medium", "hard"] as Difficulty[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`hw-hour ${difficulty === item ? "on" : ""}`}
              onClick={() => setDifficulty(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="hw-field">
        <span>Priority</span>
        <div className="hw-hours">
          {(["low", "medium", "high"] as TaskPriority[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`hw-hour ${priority === item ? "on" : ""}`}
              onClick={() => setPriority(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="hw-field">
        <span>Hours needed</span>
        <div className="hw-hours">
          {HOUR_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={`hw-hour ${minutes === option.minutes ? "on" : ""}`}
              onClick={() => setMinutes(option.minutes)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hw-edit-actions">
        <button type="button" className="hw-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="hw-save">
          Save changes
        </button>
      </div>
    </form>
  );
}

function TaskCard({
  task,
  now,
  busy,
  editing,
  leaving,
  onToggle,
  onPlan,
  onViewPlan,
  onEdit,
  onCancelEdit,
  onSave,
  onAskRemove,
}: {
  task: Task;
  now: Date;
  busy: boolean;
  editing: boolean;
  leaving: boolean;
  onToggle: () => void;
  onPlan: () => void;
  onViewPlan: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<Task>) => void;
  onAskRemove: () => void;
}) {
  const { state } = useStore();
  const badge = task.completed ? "OK" : homeworkBadge(task, state, now);
  const plan = createTaskPlan(task, state, now);
  const warn =
    !task.completed && (plan.track === "at_risk" || plan.track === "overdue")
      ? plan.track === "overdue"
        ? "Past due — finish before anything else."
        : "Not enough open time before this is due."
      : null;
  const hasPlan = Boolean(task.aiPlan?.plan?.length);
  const urgent = badge === "Urgent" && !task.completed;

  return (
    <article
      className={`task-row ${urgent ? "urgent" : ""} ${task.completed ? "done" : ""} ${leaving ? "hw-leaving" : ""}`}
    >
      <div className="task-row-main">
        <input
          type="checkbox"
          className="round-check"
          checked={task.completed}
          onChange={onToggle}
          aria-label={`Mark ${task.title} done`}
        />
        <div className="min-w-0 flex-1">
          <p className="task-name">
            <Link href={`/homework/${task.id}`}>{task.title}</Link>
          </p>
          <p className="task-meta">
            {task.className || "General"} · Due {formatDue(task.dueAt)} · {hoursNeeded(task)} needed
          </p>
          {warn && <p className="task-warn">{warn}</p>}
        </div>
        <div className="hw-actions">
          {!task.completed && (
            <>
              {hasPlan ? (
                <button type="button" className="hw-plan-btn view" onClick={onViewPlan}>
                  View plan
                </button>
              ) : (
                <button
                  type="button"
                  className={`hw-plan-btn ${busy ? "planning" : ""}`}
                  disabled={busy}
                  onClick={onPlan}
                >
                  {busy ? "Planning..." : "Plan it"}
                </button>
              )}
              <button type="button" className="hw-edit-btn" onClick={onEdit}>
                <IconEdit />
                Edit
              </button>
            </>
          )}
          {task.completed && (
            <button type="button" className="hw-remove-btn" onClick={onAskRemove}>
              <IconTrash />
              Remove
            </button>
          )}
        </div>
      </div>
      {editing && !task.completed && (
        <TaskEditForm task={task} onCancel={onCancelEdit} onSave={onSave} />
      )}
    </article>
  );
}

export default function HomeworkPage() {
  const { state, updateTask, removeTask, saveAiPlan, addPlanToSchedule } = useStore();
  const now = new Date();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeTaskItem, setRemoveTaskItem] = useState<Task | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const open = [...state.tasks]
    .filter((task) => !task.completed)
    .sort((a, b) => {
      const order = { Urgent: 0, Soon: 1, OK: 2 };
      return order[homeworkBadge(a, state, now)] - order[homeworkBadge(b, state, now)];
    });
  const done = state.tasks.filter((task) => task.completed);
  const atRisk = open.filter((task) => homeworkBadge(task, state, now) === "Urgent").length;

  async function planIt(task: Task) {
    setBusyId(task.id);
    setMessage("");
    try {
      const result = await planHoursForTask({
        task,
        events: state.events,
        studySessions: state.studySessions,
      });
      if (result.noWindows || !result.plan) {
        return;
      }
      saveAiPlan(task.id, result.plan);
      setOpenTask({ ...task, aiPlan: result.plan, planAddedToSchedule: true });
    } catch {
      return;
    } finally {
      setBusyId(null);
    }
  }

  function confirmRemove() {
    if (!removeTaskItem) return;
    const id = removeTaskItem.id;
    setRemoveTaskItem(null);
    setLeavingId(id);
    window.setTimeout(() => {
      removeTask(id);
      setLeavingId((current) => (current === id ? null : current));
    }, 280);
  }

  function renderCard(task: Task) {
    return (
      <TaskCard
        key={task.id}
        task={task}
        now={now}
        busy={busyId === task.id}
        editing={editingId === task.id}
        leaving={leavingId === task.id}
        onToggle={() =>
          updateTask(task.id, {
            completed: !task.completed,
            remainingMinutes: task.completed ? task.estimatedMinutes : 0,
          })
        }
        onPlan={() => planIt(task)}
        onViewPlan={() => setOpenTask(task)}
        onEdit={() => setEditingId(task.id)}
        onCancelEdit={() => setEditingId(null)}
        onSave={(patch) => {
          updateTask(task.id, patch);
          setEditingId(null);
        }}
        onAskRemove={() => setRemoveTaskItem(task)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--ink-soft)]">
        {state.tasks.length} {state.tasks.length === 1 ? "task" : "tasks"}
        {atRisk > 0 && <span className="badge-count ml-2">{atRisk} at risk</span>}
      </p>
      {message && <div className="home-warn">{message}</div>}

      {state.tasks.length === 0 && (
        <div className="card p-5 text-sm text-[var(--ink-soft)]">No work yet.</div>
      )}

      {open.map(renderCard)}

      {done.length > 0 && (
        <section className="hw-done-section">
          <p className="hw-done-label">Completed</p>
          {done.map(renderCard)}
        </section>
      )}

      {openTask?.aiPlan && (
        <StudyPlanModal
          task={openTask}
          plan={openTask.aiPlan}
          onAdd={
            openTask.planAddedToSchedule
              ? undefined
              : () => {
                  addPlanToSchedule(openTask.id);
                  setOpenTask(null);
                }
          }
          onClose={() => setOpenTask(null)}
        />
      )}

      {removeTaskItem && (
        <div className="hw-remove-overlay">
          <button
            type="button"
            className="hw-remove-overlay-bg"
            aria-label="Close"
            onClick={() => setRemoveTaskItem(null)}
          />
          <div className="hw-remove-modal" role="dialog" aria-labelledby="hw-remove-title">
            <p id="hw-remove-title" className="hw-remove-title">
              Remove this task?
            </p>
            <p className="hw-remove-body">
              This will permanently delete the task and its study plan. This cannot be undone.
            </p>
            <p className="hw-remove-pill">{removeTaskItem.title}</p>
            <div className="hw-remove-actions">
              <button type="button" className="hw-keep" onClick={() => setRemoveTaskItem(null)}>
                Keep it
              </button>
              <button type="button" className="hw-yes-remove" onClick={confirmRemove}>
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
