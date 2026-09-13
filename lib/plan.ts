import type { AppState, FixedEvent, ScheduledBlock } from "./types";
import {
  addDays,
  addMonths,
  daysInMonth,
  isWeekend,
  minutesFromMidnight,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toISODate,
  weekday,
} from "./time";
import { HORIZON_DAYS } from "./scheduler";

export type DayColumn = {
  day: Date;
  key: string;
  free: number;
  workBlocks: ScheduledBlock[];
  dayEvents: FixedEvent[];
};

export type PlanBucketId = "today" | "tomorrow" | "nextWeek" | "weekAfter";

export type PlanBucket = {
  id: PlanBucketId;
  label: string;
  rangeLabel: string;
  blocks: ScheduledBlock[];
};

function freeMinutesForDay(
  day: Date,
  events: FixedEvent[],
  preferences: AppState["preferences"],
): number {
  const wake = minutesFromMidnight(preferences.wakeTime);
  const end = Math.min(
    minutesFromMidnight(preferences.sleepTime),
    minutesFromMidnight(preferences.noWorkAfter),
  );
  let free = Math.max(0, end - wake);
  const dateKey = toISODate(day);
  const dow = weekday(day);
  for (const event of events) {
    const matches = event.specificDate
      ? event.specificDate === dateKey
      : event.daysOfWeek.includes(dow);
    if (!matches) continue;
    const start =
      minutesFromMidnight(event.startTime) - event.travelMinutesBefore;
    const stop = minutesFromMidnight(event.endTime) + event.travelMinutesAfter;
    const overlapStart = Math.max(wake, start);
    const overlapEnd = Math.min(end, stop);
    free -= Math.max(0, overlapEnd - overlapStart);
  }
  const cap = isWeekend(day)
    ? preferences.maxWeekendMinutes
    : preferences.maxWeeknightMinutes;
  return Math.max(0, Math.min(free, cap));
}

export function formatFreeHours(minutes: number): string {
  const hours = minutes / 60;
  return `${hours.toFixed(1)}H FREE`;
}

export function weekLoad(state: AppState): {
  ratio: number;
  label: "Light" | "Moderate" | "Heavy" | "Intense";
} {
  const today = startOfDay(new Date());
  let free = 0;
  for (let i = 0; i < HORIZON_DAYS; i += 1) {
    free += freeMinutesForDay(addDays(today, i), state.events, state.preferences);
  }
  const work = state.tasks
    .filter((task) => !task.completed)
    .reduce((sum, task) => sum + task.remainingMinutes, 0);
  const ratio = free <= 0 ? (work > 0 ? 1 : 0) : Math.min(1, work / free);
  if (ratio < 0.35) return { ratio, label: "Light" };
  if (ratio < 0.6) return { ratio, label: "Moderate" };
  if (ratio < 0.85) return { ratio, label: "Heavy" };
  return { ratio, label: "Intense" };
}

export function columnsForDays(state: AppState, days: Date[]): DayColumn[] {
  return days.map((day) => {
    const key = toISODate(day);
    const free = freeMinutesForDay(day, state.events, state.preferences);
    const workBlocks = state.blocks.filter(
      (block) => toISODate(new Date(block.start)) === key,
    );
    const dayEvents = state.events.filter((event) =>
      event.specificDate
        ? event.specificDate === key
        : event.daysOfWeek.includes(weekday(day)),
    );
    return { day, key, free, workBlocks, dayEvents };
  });
}

export function dayColumns(
  state: AppState,
  weekStart = startOfWeek(new Date()),
): DayColumn[] {
  return columnsForDays(
    state,
    Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
  );
}

export function todayColumn(state: AppState, now = new Date()): DayColumn[] {
  return columnsForDays(state, [startOfDay(now)]);
}

export function tomorrowColumn(state: AppState, now = new Date()): DayColumn[] {
  return columnsForDays(state, [addDays(startOfDay(now), 1)]);
}

export function thisWeekColumns(state: AppState, now = new Date()): DayColumn[] {
  return dayColumns(state, startOfWeek(now));
}

export function nextWeekColumns(state: AppState, now = new Date()): DayColumn[] {
  return dayColumns(state, addDays(startOfWeek(now), 7));
}

/** Next calendar month from today (e.g. in August → all of September). */
export function nextMonthColumns(state: AppState, now = new Date()): DayColumn[] {
  const next = startOfMonth(addMonths(now, 1));
  return columnsForDays(state, daysInMonth(next));
}

export function planBuckets(blocks: ScheduledBlock[], now = new Date()): PlanBucket[] {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const nextWeekStart = addDays(today, 2);
  const nextWeekEnd = addDays(today, 8);
  const weekAfterStart = addDays(today, 9);
  const weekAfterEnd = addDays(today, 15);

  const inRange = (block: ScheduledBlock, start: Date, end: Date) => {
    const day = startOfDay(new Date(block.start));
    return day >= start && day <= end;
  };

  const formatRange = (start: Date, end: Date) =>
    `${start.toLocaleDateString([], { month: "short", day: "numeric" })} – ${end.toLocaleDateString([], { month: "short", day: "numeric" })}`;

  return [
    {
      id: "today",
      label: "Today",
      rangeLabel: today.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      blocks: blocks.filter((block) => inRange(block, today, today)),
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      rangeLabel: tomorrow.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      blocks: blocks.filter((block) => inRange(block, tomorrow, tomorrow)),
    },
    {
      id: "nextWeek",
      label: "Next week",
      rangeLabel: formatRange(nextWeekStart, nextWeekEnd),
      blocks: blocks.filter((block) => inRange(block, nextWeekStart, nextWeekEnd)),
    },
    {
      id: "weekAfter",
      label: "Week after",
      rangeLabel: formatRange(weekAfterStart, weekAfterEnd),
      blocks: blocks.filter((block) =>
        inRange(block, weekAfterStart, weekAfterEnd),
      ),
    },
  ];
}

import { detectAllTimeConflicts } from "./planning";

export function conflictCount(state: AppState): number {
  const timeHits = detectAllTimeConflicts(state).length;
  const planHits = state.warnings.filter(
    (warning) =>
      warning.type === "overload" ||
      warning.type === "past_due" ||
      warning.type === "study_short",
  ).length;
  return timeHits + planHits;
}
