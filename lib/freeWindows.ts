import { formatClock, toTimeInput } from "./format";
import { addDays, formatWeekdayLong, isWeekend, minutesFromMidnight, startOfDay, toISODate, weekday } from "./time";
import type { FixedEvent, StudySession } from "./types";

export type FreeWindow = {
  day: string;
  date: string;
  dateKey: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  hoursAvailable: number;
};

export const EVENING_END = 22 * 60;
export const STUDY_EVENING = 19 * 60;
const WEEKEND_DAY_START = 18 * 60;

function eventOnDay(event: FixedEvent, day: Date): boolean {
  if (event.specificDate) return event.specificDate.slice(0, 10) === toISODate(day);
  return event.daysOfWeek.includes(weekday(day));
}

function hoursLabel(minutes: number): number {
  return Math.round((Math.max(0, minutes) / 60) * 10) / 10;
}

function mergeBusy(spans: { startMin: number; endMin: number }[]) {
  const sorted = [...spans]
    .filter((span) => span.endMin > span.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const out: { startMin: number; endMin: number }[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && span.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, span.endMin);
    } else {
      out.push({ ...span });
    }
  }
  return out;
}

function gapsInDay(
  busy: { startMin: number; endMin: number }[],
  startMin: number,
  endMin: number,
) {
  const open: { startMin: number; endMin: number }[] = [];
  let cursor = startMin;
  for (const span of mergeBusy(busy)) {
    if (span.endMin <= startMin || span.startMin >= endMin) continue;
    const lo = Math.max(span.startMin, startMin);
    const hi = Math.min(span.endMin, endMin);
    if (lo > cursor) open.push({ startMin: cursor, endMin: lo });
    cursor = Math.max(cursor, hi);
  }
  if (endMin > cursor) open.push({ startMin: cursor, endMin });
  return open.filter((span) => span.endMin - span.startMin >= 15);
}

function eveningOverlap(window: { startMin: number; endMin: number }) {
  return Math.min(window.endMin, EVENING_END) - Math.max(window.startMin, STUDY_EVENING);
}

export function preferredStudyStart(window: { startMin: number; endMin: number }) {
  if (eveningOverlap(window) >= 20 && window.startMin < STUDY_EVENING) return STUDY_EVENING;
  return window.startMin;
}

function sortWindows(windows: FreeWindow[]) {
  return [...windows].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    const aEve = eveningOverlap(a) >= 20;
    const bEve = eveningOverlap(b) >= 20;
    if (aEve !== bEve) return aEve ? -1 : 1;
    return b.endMin - b.startMin - (a.endMin - a.startMin);
  });
}

export function getFreeWindows(input: {
  events: FixedEvent[];
  fromDate: Date;
  toDate: Date;
  busySessions?: Pick<StudySession, "dateKey" | "startMin" | "endMin">[];
  excludeDateKeys?: string[];
  dueEndMin?: number;
}): FreeWindow[] {
  const start = startOfDay(input.fromDate);
  const end = startOfDay(input.toDate);
  const windows: FreeWindow[] = [];
  const skip = new Set(input.excludeDateKeys ?? []);

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const dateKey = toISODate(cursor);
    if (skip.has(dateKey)) continue;

    const lastDay = dateKey === toISODate(end);
    const eveningEnd =
      lastDay && input.dueEndMin != null
        ? Math.min(EVENING_END, input.dueEndMin)
        : EVENING_END;

    const dayEvents = input.events.filter((event) => eventOnDay(event, cursor));
    const school = dayEvents.filter((event) => event.category === "school");
    let dayStart = isWeekend(cursor) ? WEEKEND_DAY_START : 15 * 60 + 10;
    if (school.length > 0) {
      dayStart = Math.max(
        ...school.map(
          (event) => minutesFromMidnight(event.endTime) + (event.travelMinutesAfter || 0),
        ),
      );
    }

    if (dateKey === toISODate(input.fromDate)) {
      dayStart = Math.max(
        dayStart,
        input.fromDate.getHours() * 60 + input.fromDate.getMinutes(),
      );
    }

    const busy = [
      ...dayEvents.map((event) => ({
        startMin: minutesFromMidnight(event.startTime) - (event.travelMinutesBefore || 0),
        endMin: minutesFromMidnight(event.endTime) + (event.travelMinutesAfter || 0),
      })),
      ...(input.busySessions ?? [])
        .filter((session) => session.dateKey === dateKey)
        .map((session) => ({ startMin: session.startMin, endMin: session.endMin })),
    ];

    for (const gap of gapsInDay(busy, dayStart, eveningEnd)) {
      windows.push({
        day: formatWeekdayLong(cursor.getDay()),
        date: cursor.toLocaleDateString([], { month: "short", day: "numeric" }),
        dateKey,
        start: formatClock(toTimeInput(gap.startMin)),
        end: formatClock(toTimeInput(gap.endMin)),
        startMin: gap.startMin,
        endMin: gap.endMin,
        hoursAvailable: hoursLabel(gap.endMin - gap.startMin),
      });
    }
  }

  return sortWindows(windows);
}

export function isExamType(type: string): boolean {
  return type === "test" || type === "quiz";
}

export function isExamTask(task: { type: string; title?: string }): boolean {
  if (isExamType(task.type)) return true;
  return Boolean(task.title && /\b(test|quiz|exam)\b/i.test(task.title));
}

export function nightBeforeKey(dueAt: string): string {
  return toISODate(addDays(startOfDay(new Date(dueAt)), -1));
}

export function dueIsSoon(dueAt: string, now = new Date()): boolean {
  const due = startOfDay(new Date(dueAt));
  const today = startOfDay(now);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return days <= 1;
}
