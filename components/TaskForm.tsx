"use client";

import { FormEvent, useEffect, useState } from "react";
import { IconMic } from "@/components/Icons";
import {
  NoFreeTimeModal,
  PlanFallbackModal,
  StudyPlanModal,
} from "@/components/StudyPlanModal";
import { TASK_TYPES } from "@/lib/labels";
import { planHoursForTask } from "@/lib/requestStudyPlan";
import { isExamType } from "@/lib/freeWindows";
import { useStore } from "@/lib/store";
import type { AiStudyPlan, Difficulty, Task, TaskPriority, TaskType } from "@/lib/types";

type SpeechRec = {
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SavePhase = "idle" | "saving" | "planning";
type AfterSave =
  | { kind: "plan"; task: Task; plan: AiStudyPlan }
  | { kind: "noTime"; task: Task }
  | { kind: "fallback"; task: Task };

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function defaultDue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(8, 0, 0, 0);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pause(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function TaskForm() {
  const { addTask, saveAiPlan, addPlanToSchedule, state } = useStore();
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [type, setType] = useState<TaskType>("homework");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [canSplit, setCanSplit] = useState(true);
  const [listening, setListening] = useState(false);
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [dots, setDots] = useState(1);
  const [afterSave, setAfterSave] = useState<AfterSave | null>(null);

  useEffect(() => {
    if (!listening) return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec })
        .webkitSpeechRecognition;
    if (!Ctor) {
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript ?? "";
      if (said) setTitle(said.replace(/^add\s+/i, "").trim());
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    return () => rec.stop();
  }, [listening]);

  useEffect(() => {
    if (phase !== "planning") {
      setDots(1);
      return;
    }
    const timer = window.setInterval(() => setDots((count) => (count % 3) + 1), 420);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !dueAt) return;

    const exam = isExamType(type) || /\b(test|quiz|exam)\b/i.test(title);
    const minutes = Number.isFinite(estimatedMinutes) ? Math.max(10, estimatedMinutes) : exam ? 120 : 45;
    const dueIso = new Date(dueAt).toISOString();
    const split = exam ? true : canSplit;

    setPhase("saving");
    await pause(400);

    const savedTitle = title.trim();
    const savedClass = className.trim();
    const id = addTask({
      title: savedTitle,
      className: savedClass,
      type,
      dueAt: dueIso,
      estimatedMinutes: minutes,
      difficulty,
      priority: exam ? (priority === "low" ? "medium" : priority) : priority,
      canSplit: split,
    });
    const task: Task = {
      id,
      title: savedTitle,
      className: savedClass,
      type,
      dueAt: dueIso,
      estimatedMinutes: minutes,
      remainingMinutes: minutes,
      difficulty,
      priority: exam ? (priority === "low" ? "medium" : priority) : priority,
      canSplit: split,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTitle("");
    setClassName("");
    setEstimatedMinutes(type === "project" ? 120 : 45);
    setPhase("planning");

    try {
      const result = await planHoursForTask({
        task,
        events: state.events,
        studySessions: state.studySessions,
      });
      if (result.noWindows || !result.plan?.plan.length) {
        setAfterSave({ kind: "noTime", task });
        return;
      }
      saveAiPlan(id, result.plan);
      setAfterSave({
        kind: "plan",
        task: { ...task, aiPlan: result.plan, planAddedToSchedule: true },
        plan: result.plan,
      });
    } catch (error) {
      console.error("Plan generation error:", error);
      setAfterSave({ kind: "fallback", task });
    } finally {
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="voice-box flex w-full items-center gap-3 text-left"
        onClick={() => setListening(true)}
      >
        <span style={{ color: "var(--orange)" }}>
          <IconMic />
        </span>
        <span>
          <span className="block text-sm">Say it instead</span>
          <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">
            {listening ? "Listening…" : "Math homework due tomorrow, one hour"}
          </span>
        </span>
      </button>

      <form className="card p-5" onSubmit={onSubmit}>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          Task name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Lab report, chapter questions, SAT math..."
            required
          />
        </label>

        <p className="mt-4 mb-2 text-sm text-[var(--ink-soft)]">Type</p>
        <div className="pills">
          {TASK_TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`pill ${type === item.value ? "on" : ""}`}
              onClick={() => {
                setType(item.value);
                if (isExamType(item.value)) {
                  setEstimatedMinutes(120);
                  setCanSplit(true);
                  if (priority === "low") setPriority("medium");
                }
                if (item.value === "project") setEstimatedMinutes(120);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid-form mt-4">
          <label className="field">
            Class
            <input
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="Biology"
            />
          </label>
          <label className="field">
            Due
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              required
            />
          </label>
          <label className="field">
            Estimated minutes
            <input
              type="number"
              min={10}
              step={5}
              value={estimatedMinutes}
              onChange={(event) => setEstimatedMinutes(Number(event.target.value))}
              required
            />
          </label>
        </div>

        <p className="mt-4 mb-2 text-sm text-[var(--ink-soft)]">Difficulty</p>
        <div className="pills">
          {DIFFICULTIES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`pill ${difficulty === item.value ? "on" : ""}`}
              onClick={() => setDifficulty(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-4 mb-2 text-sm text-[var(--ink-soft)]">Priority</p>
        <div className="pills">
          {PRIORITIES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`pill ${priority === item.value ? "on" : ""}`}
              onClick={() => setPriority(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox"
            checked={canSplit}
            onChange={(event) => setCanSplit(event.target.checked)}
          />
          Split across multiple sittings
        </label>

        <button className={`btn save mt-6 ${busy ? "save-busy" : ""}`} type="submit" disabled={busy}>
          {phase === "saving" && "Saving..."}
          {phase === "planning" && (
            <span className="save-plan-label">
              Building your plan...
              <span className="plan-dots" aria-hidden>
                <span>{dots >= 1 ? "●" : "○"}</span>
                <span>{dots >= 2 ? "●" : "○"}</span>
                <span>{dots >= 3 ? "●" : "○"}</span>
              </span>
            </span>
          )}
          {phase === "idle" && "Save task"}
        </button>
      </form>

      {afterSave?.kind === "plan" && (
        <StudyPlanModal
          task={afterSave.task}
          plan={afterSave.plan}
          onAdd={() => {
            addPlanToSchedule(afterSave.task.id);
            setAfterSave(null);
          }}
          onClose={() => setAfterSave(null)}
        />
      )}
      {afterSave?.kind === "noTime" && (
        <NoFreeTimeModal task={afterSave.task} onClose={() => setAfterSave(null)} />
      )}
      {afterSave?.kind === "fallback" && (
        <PlanFallbackModal task={afterSave.task} onClose={() => setAfterSave(null)} />
      )}
    </div>
  );
}
