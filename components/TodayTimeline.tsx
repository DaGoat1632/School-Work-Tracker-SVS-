"use client";

import { useMemo, useState } from "react";
import { eventIntervalsForDay } from "@/lib/labels";
import { useStore } from "@/lib/store";
import {
  formatTimeRange,
  sameDay,
  startOfDay,
  toISODate,
} from "@/lib/time";

export function TodayTimeline() {
  const { state, markBlock } = useStore();
  const [partialId, setPartialId] = useState<string | null>(null);
  const [partialMinutes, setPartialMinutes] = useState(20);

  const today = startOfDay(new Date());
  const items = useMemo(() => {
    const events = eventIntervalsForDay(
      state.events,
      today.getDay(),
      toISODate(today),
    ).map((item) => {
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      start.setMinutes(item.start);
      const end = new Date(today);
      end.setHours(0, 0, 0, 0);
      end.setMinutes(item.end);
      return {
        id: item.id,
        title: item.title,
        start,
        end,
        kind: item.kind,
        color: item.color,
        status: "fixed" as const,
        minutes: 0,
      };
    });

    const work = state.blocks
      .filter((block) => sameDay(new Date(block.start), today))
      .map((block) => ({
        id: block.id,
        title: block.title,
        start: new Date(block.start),
        end: new Date(block.end),
        kind: "work" as const,
        color: "var(--work)",
        status: block.status,
        minutes: block.minutes,
      }));

    return [...events, ...work].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
  }, [state.blocks, state.events, today]);

  if (items.length === 0) {
    return (
      <div className="card p-6 text-[var(--ink-soft)]">
        Nothing on the board today. Add work or an activity and the scheduler
        will fill the gaps.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="card overflow-hidden">
          <div className="flex">
            <div className="w-1.5" style={{ background: item.color }} />
            <div className="flex flex-1 flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  {formatTimeRange(item.start, item.end)} · {item.kind}
                </p>
                <h3 className="mt-1 text-lg">{item.title}</h3>
                {"status" in item && item.kind === "work" && item.status !== "planned" && (
                  <p className="text-sm text-[var(--ink-soft)]">
                    Marked {item.status}
                  </p>
                )}
              </div>
              {item.kind === "work" && item.status === "planned" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn"
                    onClick={() => markBlock(item.id, "done")}
                  >
                    Done
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setPartialId(item.id);
                      setPartialMinutes(Math.max(10, Math.round(item.minutes / 2)));
                    }}
                  >
                    Partial
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => markBlock(item.id, "skipped")}
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          </div>
          {partialId === item.id && (
            <div className="flex flex-wrap items-end gap-3 border-t border-[var(--line)] px-4 py-3">
              <label className="field">
                Minutes actually done
                <input
                  type="number"
                  min={1}
                  max={item.minutes}
                  value={partialMinutes}
                  onChange={(event) =>
                    setPartialMinutes(Number(event.target.value))
                  }
                />
              </label>
              <button
                className="btn"
                onClick={() => {
                  markBlock(item.id, "partial", partialMinutes);
                  setPartialId(null);
                }}
              >
                Save and replan
              </button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
