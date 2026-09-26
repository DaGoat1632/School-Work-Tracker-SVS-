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
  const wake = isWeekend(day)
    ? minutesFromMidnight(preferences.wakeTime)
    : afterSchoolStart(day, events);
  const end = Math.min(
    minutesFromMidnight(preferences.sleepTime),
    minutesFromMidnight(preferences.noWorkAfter),
  );
  let free = Math.max(0, end - wake);
  const dateKey = toISODate(day);
  const dow = weekday(day);
  for (const event of events) {
    const matches = event.specificDate
      ? event.specificDate.slice(0, 10) === dateKey
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

const AFTER_SCHOOL_END = 22 * 60;
const WEEKDAY_AFTER_SCHOOL = 15 * 60 + 10;
const WEEKEND_AFTER_SCHOOL = 18 * 60;

function eventOnDay(event: FixedEvent, day: Date): boolean {
  const dateKey = toISODate(day);
  return event.specificDate
    ? event.specificDate.slice(0, 10) === dateKey
    : event.daysOfWeek.includes(weekday(day));
}

export function afterSchoolStart(day: Date, events: FixedEvent[]): number {
  const schoolEnds = events
    .filter((event) => event.category === "school" && eventOnDay(event, day))
    .map(
      (event) =>
        minutesFromMidnight(event.endTime) + (event.travelMinutesAfter || 0),
    );
  if (schoolEnds.length) return Math.max(...schoolEnds);
  return isWeekend(day) ? WEEKEND_AFTER_SCHOOL : WEEKDAY_AFTER_SCHOOL;
}

function mergeBusyMinutes(spans: { start: number; end: number }[]): number {
  const sorted = [...spans]
    .filter((span) => span.end > span.start)
    .sort((a, b) => a.start - b.start);
  if (!sorted.length) return 0;
  let minutes = 0;
  let curStart = sorted[0].start;
  let curEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i += 1) {
    const span = sorted[i];
    if (span.start <= curEnd) {
      curEnd = Math.max(curEnd, span.end);
    } else {
      minutes += curEnd - curStart;
      curStart = span.start;
      curEnd = span.end;
    }
  }
  return minutes + (curEnd - curStart);
}

export function weekLoad(
  state: AppState,
  now = new Date(),
): {
  ratio: number;
  label: "Light" | "Medium" | "Heavy";
} {
  const weekStart = startOfWeek(now);
  let total = 0;
  let busy = 0;

  for (let i = 0; i < 7; i += 1) {
    const day = addDays(weekStart, i);
    const dateKey = toISODate(day);
    const windowStart = afterSchoolStart(day, state.events);
    const windowMins = Math.max(0, AFTER_SCHOOL_END - windowStart);
    total += windowMins;

    const spans: { start: number; end: number }[] = [];
    for (const event of state.events) {
      if (event.category === "school" || !eventOnDay(event, day)) continue;
      const start =
        minutesFromMidnight(event.startTime) - (event.travelMinutesBefore || 0);
      const end =
        minutesFromMidnight(event.endTime) + (event.travelMinutesAfter || 0);
      spans.push({
        start: Math.max(start, windowStart),
        end: Math.min(end, AFTER_SCHOOL_END),
      });
    }
    for (const session of state.studySessions) {
      if (session.dateKey !== dateKey) continue;
      spans.push({
        start: Math.max(session.startMin, windowStart),
        end: Math.min(session.endMin, AFTER_SCHOOL_END),
      });
    }
    busy += mergeBusyMinutes(spans);
  }

  const ratio = total <= 0 ? 0 : Math.min(1, busy / total);
  if (ratio <= 0.5) return { ratio, label: "Light" };
  if (ratio <= 0.75) return { ratio, label: "Medium" };
  return { ratio, label: "Heavy" };
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
        ? event.specificDate.slice(0, 10) === key
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
