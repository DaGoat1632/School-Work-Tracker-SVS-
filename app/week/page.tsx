"use client";

import { WeekGrid } from "@/components/WeekGrid";
import { WarningList } from "@/components/WarningList";
import { useStore } from "@/lib/store";

export default function WeekPage() {
  const { replan, resetDemo } = useStore();

  return (
    <main>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl">This week</h2>
          <p className="mt-1 max-w-2xl text-[var(--ink-soft)]">
            Navy and green are fixed. Terracotta is homework the scheduler
            placed around them. The shaded evening is off-limits for work.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn secondary" onClick={replan}>
            Rebuild
          </button>
          <button className="btn ghost" onClick={resetDemo}>
            Reset demo week
          </button>
        </div>
      </div>
      <WarningList />
      <WeekGrid />
    </main>
  );
}
