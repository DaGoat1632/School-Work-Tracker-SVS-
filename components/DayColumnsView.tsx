"use client";

import { eventColor } from "@/lib/labels";
import type { DayColumn } from "@/lib/plan";
import { formatFreeHours } from "@/lib/plan";
import {
  formatClock,
  formatDuration,
  hourLabel,
  minutesOf,
} from "@/lib/format";
import { useStore } from "@/lib/store";
import { formatWeekday } from "@/lib/time";

const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;

type TimelineItem = {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  kind: "work" | "event" | "travel";
  color: string;
  minutes: number;
  status?: string;
  workId?: string;
};

function buildItems(column: DayColumn, planReady: boolean): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const event of column.dayEvents) {
    const start = minutesOf(event.startTime);
    const end = minutesOf(event.endTime);
    if (event.travelMinutesBefore > 0) {
      items.push({
        id: `${event.id}-tb`,
        title: `Travel → ${event.title}`,
        startMin: Math.max(0, start - event.travelMinutesBefore),
        endMin: start,
        kind: "travel",
        color: "var(--travel)",
        minutes: event.travelMinutesBefore,
      });
    }
    items.push({
      id: event.id,
      title: event.title,
      startMin: start,
      endMin: end,
      kind: "event",
      color: eventColor(event.category),
      minutes: Math.max(0, end - start),
    });
    if (event.travelMinutesAfter > 0) {
      items.push({
        id: `${event.id}-ta`,
        title: `Travel ← ${event.title}`,
        startMin: end,
        endMin: end + event.travelMinutesAfter,
        kind: "travel",
        color: "var(--travel)",
        minutes: event.travelMinutesAfter,
      });
    }
  }

  if (planReady) {
    for (const block of column.workBlocks) {
      const start = minutesOf(block.start);
      const end = minutesOf(block.end);
      items.push({
        id: block.id,
        title: block.title,
        startMin: start,
        endMin: end,
        kind: "work",
        color: "var(--work)",
        minutes: block.minutes,
        status: block.status,
        workId: block.id,
      });
    }
  }

  return items.sort((a, b) => a.startMin - b.startMin);
}

function DayTimeline({
  column,
  compact = false,
}: {
  column: DayColumn;
  compact?: boolean;
}) {
  const { state, toggleBlockDone } = useStore();
  const items = buildItems(column, state.planReady);
  const workMinutes = column.workBlocks
    .filter((block) => block.status !== "done")
    .reduce((sum, block) => sum + block.minutes, 0);
  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, index) => START_HOUR + index,
  );
  const height = compact ? 420 : 640;

  return (
    <article className="timeline-card">
      <header className="timeline-head">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            {formatWeekday(column.day)}
          </p>
          <p className="display text-3xl leading-none">{column.day.getDate()}</p>
        </div>
        <div className="text-right text-sm">
          <p style={{ color: "var(--ok)", fontWeight: 650 }}>
            {formatFreeHours(column.free)}
          </p>
          <p className="text-[var(--ink-soft)]">
            {workMinutes > 0
              ? `${formatDuration(workMinutes)} of work`
              : state.planReady
                ? "No work blocks"
                : "Generate a plan for work times"}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[var(--ink-soft)]">
          Nothing on the timeline for this day yet.
        </p>
      ) : (
        <>
          <ol className="timeline-list">
            {items.map((item) => (
              <li
                key={item.id}
                className={`timeline-row ${item.kind} ${item.status === "done" ? "done" : ""}`}
              >
                <div className="timeline-when">
                  <strong>{formatClock(toClock(item.startMin))}</strong>
                  <span>{formatDuration(item.minutes)}</span>
                </div>
                <div
                  className="timeline-block"
                  style={{ background: item.color }}
                >
                  <div className="timeline-block-main">
                    <p className="timeline-title">{item.title}</p>
                    <p className="timeline-meta">
                      {formatClock(toClock(item.startMin))} –{" "}
                      {formatClock(toClock(item.endMin))}
                      {item.kind === "work" ? " · study block" : ""}
                      {item.kind === "travel" ? " · travel" : ""}
                    </p>
                  </div>
                  {item.kind === "work" && item.workId && (
                    <label className="timeline-check">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={item.status === "done"}
                        onChange={() => toggleBlockDone(item.workId!)}
                        aria-label={`Mark ${item.title} done`}
                      />
                      <span>Done</span>
                    </label>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="timeline-rail-wrap" style={{ height }}>
            <div className="timeline-hours">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="timeline-hour"
                  style={{
                    top: `${((hour - START_HOUR) * 60) / TOTAL_MIN * 100}%`,
                  }}
                >
                  {hourLabel(hour)}
                </div>
              ))}
            </div>
            <div className="timeline-rail">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="timeline-gridline"
                  style={{
                    top: `${((hour - START_HOUR) * 60) / TOTAL_MIN * 100}%`,
                  }}
                />
              ))}
              {items.map((item) => {
                const top =
                  ((Math.max(item.startMin, START_HOUR * 60) - START_HOUR * 60) /
                    TOTAL_MIN) *
                  100;
                const end = Math.min(item.endMin, END_HOUR * 60);
                const start = Math.max(item.startMin, START_HOUR * 60);
                const h = Math.max(((end - start) / TOTAL_MIN) * 100, 2.2);
                return (
                  <div
                    key={`rail-${item.id}`}
                    className="timeline-rail-block"
                    style={{
                      top: `${top}%`,
                      height: `${h}%`,
                      background: item.color,
                      opacity: item.status === "done" ? 0.4 : item.kind === "travel" ? 0.7 : 0.95,
                    }}
                    title={`${item.title} · ${formatDuration(item.minutes)}`}
                  >
                    <strong>{item.title}</strong>
                    <span>{formatDuration(item.minutes)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function DayColumnsView({
  columns,
  layout = "week",
}: {
  columns: DayColumn[];
  layout?: "week" | "stack" | "month";
}) {
  const gridClass =
    layout === "week"
      ? "grid gap-4 xl:grid-cols-2"
      : layout === "month"
        ? "grid gap-4 lg:grid-cols-2"
        : "grid gap-4";

  return (
    <section className={gridClass}>
      {columns.map((column) => (
        <DayTimeline
          key={column.key}
          column={column}
          compact={layout !== "stack"}
        />
      ))}
    </section>
  );
}
