"use client";

import { eventIntervalsForDay } from "@/lib/labels";
import { useStore } from "@/lib/store";
import {
  addDays,
  formatTime,
  formatWeekday,
  minutesFromMidnight,
  startOfWeek,
  toISODate,
} from "@/lib/time";

const START_HOUR = 6;
const END_HOUR = 23;
const TOTAL = (END_HOUR - START_HOUR) * 60;

function top(minutes: number): number {
  return ((minutes - START_HOUR * 60) / TOTAL) * 100;
}

function height(start: number, end: number): number {
  return ((end - start) / TOTAL) * 100;
}

export function WeekGrid() {
  const { state } = useStore();
  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="card overflow-x-auto p-3 md:p-4">
      <div className="grid min-w-[860px] grid-cols-[72px_repeat(7,1fr)]">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="px-2 pb-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              {formatWeekday(day)}
            </p>
            <p className="display text-2xl">{day.getDate()}</p>
          </div>
        ))}
        <div className="relative" style={{ height: 1088 }}>
          {hours.map((hour, index) => (
            <div
              key={hour}
              className="absolute right-2 text-[11px] text-[var(--ink-soft)]"
              style={{ top: `${(index / hours.length) * 100}%` }}
            >
              {hour > 12 ? hour - 12 : hour}
              {hour >= 12 ? "p" : "a"}
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dateKey = toISODate(day);
          const events = eventIntervalsForDay(state.events, day.getDay(), dateKey);
          const blocks = state.blocks.filter(
            (block) => toISODate(new Date(block.start)) === dateKey,
          );
          return (
            <div
              key={dateKey}
              className="relative border-l border-[var(--line)]"
              style={{ height: 1088 }}
            >
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t border-[var(--line)]"
                  style={{ top: `${(index / hours.length) * 100}%` }}
                />
              ))}
              {events.map((event) => (
                <div
                  key={event.id}
                  className="absolute inset-x-1 overflow-hidden rounded-xl px-2 py-1 text-[11px] text-[#f7efe3]"
                  style={{
                    top: `${top(event.start)}%`,
                    height: `${Math.max(height(event.start, event.end), 3.2)}%`,
                    background: event.color,
                    opacity: event.kind === "travel" ? 0.72 : 0.92,
                  }}
                >
                  <strong className="block truncate">{event.title}</strong>
                </div>
              ))}
              {blocks.map((block) => {
                const start = new Date(block.start);
                const end = new Date(block.end);
                const startMin = start.getHours() * 60 + start.getMinutes();
                const endMin = end.getHours() * 60 + end.getMinutes();
                return (
                  <div
                    key={block.id}
                    className="absolute inset-x-1 overflow-hidden rounded-xl border border-[#f3c3ad] bg-[#c24a1a] px-2 py-1 text-[11px] text-[#fff4ec]"
                    style={{
                      top: `${top(startMin)}%`,
                      height: `${Math.max(height(startMin, endMin), 3.2)}%`,
                      opacity: block.status === "planned" ? 1 : 0.55,
                    }}
                  >
                    <strong className="block truncate">{block.title}</strong>
                    <span>
                      {formatTime(start)} · {block.minutes}m
                    </span>
                  </div>
                );
              })}
              {minutesFromMidnight(state.preferences.sleepTime) > START_HOUR * 60 && (
                <div
                  className="absolute inset-x-0 bg-[#1b1712]/6"
                  style={{
                    top: `${top(minutesFromMidnight(state.preferences.noWorkAfter))}%`,
                    height: `${height(minutesFromMidnight(state.preferences.noWorkAfter), END_HOUR * 60)}%`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)]">
        <span className="chip">Work</span>
        <span className="chip">Fixed activities</span>
        <span className="chip">Travel buffers</span>
        <span className="chip">No-work evening</span>
      </div>
    </div>
  );
}
