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

const EVENING_END = 22 * 60;
const WEEKEND_EVENING_START = 18 * 60;
const SETTLE_AFTER_SCHOOL = 30;
const SETTLE_AFTER_ACTIVITY = 15;

function eventOnDay(event: FixedEvent, day: Date): boolean {
  if (event.specificDate) return event.specificDate.slice(0, 10) === toISODate(day);
  return event.daysOfWeek.includes(weekday(day));
}

function hoursLabel(minutes: number): number {
  return Math.round((Math.max(0, minutes) / 60) * 10) / 10;
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
    const activities = dayEvents.filter((event) => event.category !== "school");

    let eveningStart = isWeekend(cursor) ? WEEKEND_EVENING_START : 15 * 60 + 10;
    if (school.length > 0) {
      const schoolEnd = Math.max(...school.map((event) => minutesFromMidnight(event.endTime)));
      const travelHome = Math.max(...school.map((event) => event.travelMinutesAfter || 0));
      eveningStart = schoolEnd + travelHome + SETTLE_AFTER_SCHOOL;
    }

    for (const activity of activities) {
      const activityEnd = minutesFromMidnight(activity.endTime);
      const travelHome = activity.travelMinutesAfter || 0;
      const released = activityEnd + travelHome + SETTLE_AFTER_ACTIVITY;
      if (released > eveningStart && minutesFromMidnight(activity.startTime) < eveningEnd) {
        eveningStart = Math.max(eveningStart, released);
      }
    }

    for (const session of input.busySessions ?? []) {
      if (session.dateKey !== dateKey) continue;
      if (session.endMin > eveningStart && session.startMin < eveningEnd) {
        eveningStart = Math.max(eveningStart, session.endMin + SETTLE_AFTER_ACTIVITY);
      }
    }

    if (dateKey === toISODate(input.fromDate)) {
      eveningStart = Math.max(
        eveningStart,
        input.fromDate.getHours() * 60 + input.fromDate.getMinutes(),
      );
    }

    const minutes = eveningEnd - eveningStart;
    if (minutes < 15) continue;

    windows.push({
      day: formatWeekdayLong(cursor.getDay()),
      date: cursor.toLocaleDateString([], { month: "short", day: "numeric" }),
      dateKey,
      start: formatClock(toTimeInput(eveningStart)),
      end: formatClock(toTimeInput(eveningEnd)),
      startMin: eveningStart,
      endMin: eveningEnd,
      hoursAvailable: hoursLabel(minutes),
    });
  }

  return windows;
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
