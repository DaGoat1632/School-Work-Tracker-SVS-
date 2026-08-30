"use client";

import { FormEvent, useState } from "react";
import { TASK_TYPES } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Difficulty, TaskType } from "@/lib/types";

function defaultDue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(8, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TaskForm() {
  const addTask = useStore().addTask;
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [type, setType] = useState<TaskType>("homework");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [canSplit, setCanSplit] = useState(true);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      className: className.trim(),
      type,
      dueAt: new Date(dueAt).toISOString(),
      estimatedMinutes,
      difficulty,
      canSplit,
    });
    setTitle("");
    setClassName("");
    setEstimatedMinutes(type === "project" ? 120 : 45);
  }

  return (
    <form className="card p-5" onSubmit={onSubmit}>
      <h2 className="text-2xl">Add work</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--ink-soft)]">
        Due date, estimate, and difficulty are what the scheduler actually uses.
      </p>
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
          <select value={type} onChange={(event) => setType(event.target.value as TaskType)}>
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
            <option value="easy">Easy — fine later in the evening</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard — schedule while you are fresher</option>
          </select>
        </label>
        <label className="field mt-6 flex-row items-center gap-2 text-[var(--ink)]" style={{ flexDirection: "row" }}>
          <input
            type="checkbox"
            checked={canSplit}
            onChange={(event) => setCanSplit(event.target.checked)}
          />
          Split across multiple sittings
        </label>
      </div>
      <button className="btn mt-5" type="submit">
        Add and rebuild week
      </button>
    </form>
  );
}
