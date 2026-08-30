"use client";

import Link from "next/link";
import { DayColumnsView } from "@/components/DayColumnsView";
import type { DayColumn } from "@/lib/plan";
import { useStore } from "@/lib/store";

export function SchedulePage({
  title,
  blurb,
  rangeLabel,
  columns,
  layout = "week",
}: {
  title: string;
  blurb: string;
  rangeLabel: string;
  columns: DayColumn[];
  layout?: "week" | "stack" | "month";
}) {
  const { state, generatePlan } = useStore();

  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-4xl leading-none">{title}</h1>
        <p className="mt-2 text-[var(--ink-soft)]">{blurb}</p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{rangeLabel}</p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <Link href="/add/work" className="btn work">
          + Add work
        </Link>
        <Link href="/add/extracurricular" className="btn secondary">
          + Extracurricular
        </Link>
        <Link href="/add/sports" className="btn secondary">
          + Sports & games
        </Link>
        <Link href="/add/other" className="btn secondary">
          + Other
        </Link>
        <Link href="/homework" className="btn ghost">
          Homework list
        </Link>
        <button
          className="btn"
          onClick={generatePlan}
          disabled={state.tasks.length === 0 && state.events.length === 0}
        >
          {state.planReady ? "Rebuild plan" : "Generate plan"}
        </button>
      </section>

      {!state.planReady && (
        <section className="card p-4 text-sm text-[var(--ink-soft)]">
          Add work and activities with the buttons above, then press{" "}
          <strong>Generate plan</strong> to fill homework into free time.
        </section>
      )}

      {state.warnings.length > 0 && (
        <section className="space-y-2">
          {state.warnings.slice(0, 3).map((warning, index) => (
            <div key={`${warning.taskId}-${index}`} className="warn-card">
              <strong>⚠ {warning.message.split(".")[0]}</strong>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{warning.message}</p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <div>
          <h2 className="text-2xl">Timeline</h2>
          <p className="text-sm text-[var(--ink-soft)]">
            See when to work and how long each block takes. Fixed activities are
            on the same day clock so you can plan around them.
          </p>
        </div>
        <DayColumnsView columns={columns} layout={layout} />
      </section>
    </main>
  );
}
