"use client";

import { FormEvent, useState } from "react";
import { TASK_TYPES } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Difficulty, TaskPriority, TaskType } from "@/lib/types";

function defaultDue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(8, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TaskForm({
  heading = "Add work",
  blurb = "Homework, projects, quizzes, and tests. Submit everything, then generate your plan on Weekly.",
}: {
  heading?: string;
  blurb?: string;
}) {
  const addTask = useStore().addTask;
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [type, setType] = useState<TaskType>("homework");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [canSplit, setCanSplit] = useState(true);
  const [saved, setSaved] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      className: className.trim(),
      type,
      dueAt: new Date(dueAt).toISOString(),
      estimatedMinutes: Number.isFinite(estimatedMinutes)
        ? Math.max(0, estimatedMinutes)
        : 45,
      difficulty,
      priority,
      canSplit: type === "test" || type === "quiz" ? true : canSplit,
    });
    setTitle("");
    setClassName("");
    setEstimatedMinutes(type === "project" ? 120 : 45);
    setSaved(true);
  }

  return (
    <form className="card p-5" onSubmit={onSubmit}>
      <h2 className="text-2xl">{heading}</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--ink-soft)]">{blurb}</p>
      <div className="grid-form">
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Lab report, chapter questions, SAT math..."
            required
          />
        </label>
        <label className="field">
          Class
          <input
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            placeholder="Biology"
          />
        </label>
        <label className="field">
          Type
          <select
            value={type}
            onChange={(event) => setType(event.target.value as TaskType)}
          >
            {TASK_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
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
          />
        </label>
        <label className="field">
          Difficulty
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="field">
          Priority
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label
          className="field mt-6 items-center gap-2 text-[var(--ink)]"
          style={{ flexDirection: "row" }}
        >
          <input
            type="checkbox"
            checked={canSplit}
            onChange={(event) => setCanSplit(event.target.checked)}
          />
          Split across multiple sittings
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn work" type="submit">
          Save work
        </button>
        {saved && (
          <p className="text-sm" style={{ color: "var(--ok)" }}>
            Saved. Add more, or go to Weekly and generate your plan.
          </p>
        )}
      </div>
    </form>
  );
}
