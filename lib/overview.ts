import { formatClockRange, formatHoursShort } from "./format";
import {
  calculateFreeTime,
  createTaskPlan,
  detectAllTimeConflicts,
  getCoachDayPlan,
  isAcademicSchoolDay,
  occupanciesForEvent,
  scheduleRank,
} from "./planning";
import { weekLoad, afterSchoolStart } from "./plan";
import { isExamTask } from "./freeWindows";
import { addDays, formatWeekdayLong, isWeekend, startOfDay, startOfMonth, startOfWeek, toISODate, weekday } from "./time";
import type { AppState, Task } from "./types";

export type CompactTone = "school" | "sport" | "club" | "free" | "risk" | "travel" | "homework";

export type CompactBlock = {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  minutes: number;
  tone: CompactTone;
  detail?: string;
  bestWindow?: boolean;
  study?: boolean;
};

export type DayDot = "activity" | "conflict" | "free" | "off";

export type HomeworkBadge = "Urgent" | "Soon" | "OK";

const EVENING_START = 18 * 60;
const EVENING_END = 22 * 60;
const MORNING_END = 12 * 60;
const PREP_BEFORE_ACTIVITY = 30;
const CLOCK_STEP = 30;

function snapFreeStart(minutes: number): number {
  return Math.ceil(minutes / CLOCK_STEP) * CLOCK_STEP;
}

function snapFreeEnd(minutes: number): number {
  return Math.round(minutes / CLOCK_STEP) * CLOCK_STEP;
}

function snapFreeSpan(span: { startMin: number; endMin: number; minutes: number }) {
  const startMin = snapFreeStart(span.startMin);
  const endMin = Math.max(startMin, snapFreeEnd(span.endMin));
  return { startMin, endMin, minutes: endMin - startMin };
}

function minOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function hoursNice(minutes: number): string {
  const rounded = Math.round(Math.max(0, minutes) / 30) / 2;
  if (rounded === 0 && minutes > 0) return formatHoursShort(minutes);
  if (Number.isInteger(rounded)) return `${rounded}h`;
  return `${rounded}h`;
}

function neededLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min needed`;
  return `${hoursNice(minutes)} needed`;
}

export function hoursPhrase(minutes: number): string {
  const label = hoursNice(minutes).replace(/h$/, "");
  return Number(label) === 1 ? "1 hour" : `${label} hours`;
}

function firstEveningSlot(state: AppState, day: Date) {
  const slots = calculateFreeTime(state, day, {
    now: startOfDay(day),
    includeWorkBlocks: false,
  });
  return slots
    .map((slot) => ({
      startMin: slot.startMin,
      endMin: Math.min(slot.endMin, 22 * 60),
    }))
    .filter((slot) => slot.endMin - slot.startMin >= 20)
    .sort((a, b) => a.startMin - b.startMin)[0] ?? null;
}

function longestEveningSlot(state: AppState, day: Date) {
  const slots = calculateFreeTime(state, day, {
    now: startOfDay(day),
    includeWorkBlocks: false,
  });
  return (
    slots
      .map((slot) => ({
        startMin: Math.max(slot.startMin, 17 * 60),
        endMin: Math.min(slot.endMin, 22 * 60),
      }))
      .filter((slot) => slot.endMin - slot.startMin >= 20)
      .sort((a, b) => b.endMin - b.startMin - (a.endMin - a.startMin))[0] ?? null
  );
}

function mergeBusy(spans: { startMin: number; endMin: number }[]) {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin);
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

function freeSpans(
  busy: { startMin: number; endMin: number }[],
  windowStart: number,
  windowEnd: number,
) {
  const clipped = mergeBusy(
    busy
      .map((span) => ({
        startMin: Math.max(span.startMin, windowStart),
        endMin: Math.min(span.endMin, windowEnd),
      }))
      .filter((span) => span.endMin > span.startMin),
  );
  const open: { startMin: number; endMin: number; minutes: number }[] = [];
  let cursor = windowStart;
  for (const span of clipped) {
    if (span.startMin > cursor) {
      open.push({
        startMin: cursor,
        endMin: span.startMin,
        minutes: span.startMin - cursor,
      });
    }
    cursor = Math.max(cursor, span.endMin);
  }
  if (windowEnd > cursor) {
    open.push({ startMin: cursor, endMin: windowEnd, minutes: windowEnd - cursor });
  }
  return open;
}

function openStudyBusy(state: AppState, day: Date) {
  const key = toISODate(day);
  return (state.studySessions ?? [])
    .filter(
      (session) =>
        session.dateKey === key &&
        !session.completed &&
        !session.skipped &&
        session.endMin > session.startMin,
    )
    .map((session) => ({ startMin: session.startMin, endMin: session.endMin }));
}

/** Busy blocks that start 30 minutes before an activity so free time stops then. */
function paddedBusy(state: AppState, day: Date) {
  const events = eventsOnDay(state, day).flatMap((event) => {
    const eventStart = minOf(event.startTime);
    return occupanciesForEvent(event, day).map((span) => ({
      startMin: Math.min(span.startMin, eventStart - PREP_BEFORE_ACTIVITY),
      endMin: span.endMin,
    }));
  });
  const study = openStudyBusy(state, day).map((span) => ({
    startMin: span.startMin - PREP_BEFORE_ACTIVITY,
    endMin: span.endMin,
  }));
  return [...events, ...study];
}

function wakeMin(state: AppState) {
  return minOf(state.preferences.wakeTime || "07:00");
}

function freeFrom(state: AppState, day: Date) {
  if (isWeekend(day)) return wakeMin(state);
  return afterSchoolStart(day, state.events);
}

function freeUntil(state: AppState, day: Date) {
  if (!isWeekend(day)) return EVENING_END;
  const first = mergeBusy(paddedBusy(state, day))
    .filter((span) => span.endMin > wakeMin(state))
    .sort((a, b) => a.startMin - b.startMin)[0];
  if (!first) return MORNING_END;
  return Math.max(wakeMin(state), Math.min(first.startMin, EVENING_END));
}

/** Weekdays: after school through 10pm. Weekends: wake until 30 min before the first activity. */
function dayFreeSpans(state: AppState, day: Date) {
  const from = freeFrom(state, day);
  const until = freeUntil(state, day);
  if (until - from <= 15) return [];
  return freeSpans(paddedBusy(state, day), from, until)
    .map(snapFreeSpan)
    .filter((span) => span.minutes > 15);
}

export function dueDayWord(iso: string, now = new Date()): string {
  const due = startOfDay(new Date(iso));
  const diff = Math.round((due.getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  return formatWeekdayLong(new Date(iso).getDay());
}

function eventDateKey(value?: string) {
  return (value ?? "").slice(0, 10);
}

export function eventsOnDay(state: AppState, day: Date) {
  const key = toISODate(day);
  const dow = weekday(day);
  return state.events.filter((event) => {
    const oneOff = eventDateKey(event.specificDate);
    if (oneOff) return oneOff === key;
    return event.daysOfWeek.includes(dow);
  });
}

export function homeworkBadge(task: Task, state: AppState, now = new Date()): HomeworkBadge {
  const plan = createTaskPlan(task, state, now);
  const hours = (new Date(task.dueAt).getTime() - now.getTime()) / 3_600_000;
  if (plan.track === "overdue" || plan.track === "at_risk" || hours < 24) return "Urgent";
  if (plan.track === "needs_planning" || hours < 72) return "Soon";
  return "OK";
}

export function studyStreak(state: AppState, now = new Date()): number {
  let streak = 0;
  for (let offset = 0; offset < 21; offset += 1) {
    const day = addDays(startOfDay(now), -offset);
    const key = toISODate(day);
    const done = state.blocks.some(
      (block) => block.status === "done" && toISODate(new Date(block.start)) === key,
    );
    if (done) {
      streak += 1;
      continue;
    }
    if (offset === 0) continue;
    break;
  }
  return streak;
}

export function tonightWindow(state: AppState, now = new Date()) {
  const day = startOfDay(now);
  const free = dayFreeSpans(state, day);
  const total = free.reduce((sum, span) => sum + span.minutes, 0);
  const longest = [...free].sort((a, b) => b.minutes - a.minutes)[0] ?? snapFreeSpan({
    startMin: freeFrom(state, day),
    endMin: freeUntil(state, day),
    minutes: 0,
  });
  const rangeLabel = free.length
    ? free.map((span) => formatClockRange(span.startMin, span.endMin)).join(" or ")
    : formatClockRange(snapFreeStart(freeFrom(state, day)), snapFreeEnd(freeUntil(state, day)));
  const scheduledIds = new Set(
    (state.studySessions ?? [])
      .filter((session) => !session.skipped)
      .map((session) => session.taskId),
  );
  const open = state.tasks.filter((task) => !task.completed);
  const upcomingTest = [...open]
    .filter((task) => isExamTask(task))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  const unscheduled = [...open]
    .filter(
      (task) =>
        !scheduledIds.has(task.id) &&
        (task.remainingMinutes || task.estimatedMinutes) > 0,
    )
    .sort((a, b) => {
      const rank = scheduleRank(a, now) - scheduleRank(b, now);
      if (rank !== 0) return rank;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    })[0];
  const kind =
    upcomingTest?.type === "quiz" || /\bquiz\b/i.test(upcomingTest?.title ?? "")
      ? "quiz"
      : "test";
  const heroLine = upcomingTest
    ? `Consider using your free time for your upcoming ${kind} — ${upcomingTest.title}.`
    : unscheduled
      ? `Use it for ${unscheduled.title} — due ${dueDayWord(unscheduled.dueAt, now)}`
      : "Great time to get ahead";
  return {
    startMin: longest.startMin,
    endMin: longest.endMin,
    minutes: total,
    hoursLabel: hoursNice(total),
    rangeLabel,
    heroLine,
  };
}

export function homeConflicts(state: AppState, now = new Date()) {
  return [...state.tasks]
    .filter((task) => !task.completed)
    .map((task) => ({ task, plan: createTaskPlan(task, state, now) }))
    .filter(
      ({ plan }) =>
        plan.track === "at_risk" || plan.track === "overdue" || plan.shortBy > 0,
    )
    .sort((a, b) => new Date(a.task.dueAt).getTime() - new Date(b.task.dueAt).getTime())
    .slice(0, 2)
    .map(({ task, plan }) => ({
      id: task.id,
      text: `${task.title} is due ${dueDayWord(task.dueAt, now)} — only ${hoursNice(plan.availableBeforeDeadline)} free before then. Tonight is your best window.`,
    }));
}

export function weekTaskStats(state: AppState, now = new Date()) {
  const start = startOfWeek(now);
  const end = addDays(start, 7);
  const dueThisWeek = state.tasks.filter((task) => {
    if (task.completed) return false;
    const due = new Date(task.dueAt);
    return due >= start && due < end;
  });
  const urgent = dueThisWeek.filter((task) => homeworkBadge(task, state, now) === "Urgent").length;
  return { count: dueThisWeek.length, urgent };
}

export function homeLoad(state: AppState) {
  return weekLoad(state);
}

export function upcomingDeadlineRows(state: AppState, now = new Date(), limit = 6) {
  return [...state.tasks]
    .filter((task) => !task.completed)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, limit)
    .map((task) => {
      const due = startOfDay(new Date(task.dueAt));
      const days = Math.round((due.getTime() - startOfDay(now).getTime()) / 86_400_000);
      const badge = homeworkBadge(task, state, now);
      const daysLabel =
        days < 0 ? "Overdue" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;
      const needed = task.remainingMinutes || task.estimatedMinutes || 0;
      return {
        task,
        badge,
        days,
        daysLabel,
        dueToday: days === 0,
        neededLabel: needed < 60 ? `${needed} min needed` : `${hoursNice(needed)} needed`,
      };
    });
}

export function compactTodaySchedule(state: AppState, now = new Date()): CompactBlock[] {
  return todayScheduleRows(state, now);
}

function eventTone(category: AppState["events"][number]["category"]): CompactTone {
  if (category === "sports") return "sport";
  if (category === "school" || category === "commute") return category === "commute" ? "travel" : "school";
  return "club";
}

function eventBlocksOnDay(state: AppState, day: Date, includeTravel = true): CompactBlock[] {
  const blocks: CompactBlock[] = [];
  const events = [...eventsOnDay(state, day)].sort(
    (a, b) => minOf(a.startTime) - minOf(b.startTime),
  );
  for (const event of events) {
    const startMin = minOf(event.startTime);
    const endMin = minOf(event.endTime);
    if (includeTravel && event.travelMinutesBefore > 0) {
      blocks.push({
        id: `${event.id}-tb`,
        title: `Travel to ${event.title}`,
        startMin: startMin - event.travelMinutesBefore,
        endMin: startMin,
        minutes: event.travelMinutesBefore,
        tone: "travel",
      });
    }
    blocks.push({
      id: event.id,
      title: event.title,
      startMin,
      endMin,
      minutes: Math.max(0, endMin - startMin),
      tone: eventTone(event.category),
    });
    if (includeTravel && event.travelMinutesAfter > 0) {
      blocks.push({
        id: `${event.id}-ta`,
        title: event.category === "sports" ? "Travel home" : `Travel from ${event.title}`,
        startMin: endMin,
        endMin: endMin + event.travelMinutesAfter,
        minutes: event.travelMinutesAfter,
        tone: "travel",
      });
    }
  }
  return blocks;
}

export function studyBlocksForDay(state: AppState, day: Date): CompactBlock[] {
  const key = toISODate(day);
  return (state.studySessions ?? [])
    .filter((session) => session.dateKey === key && !session.skipped)
    .map((session) => {
      const task = state.tasks.find((item) => item.id === session.taskId);
      return {
        id: session.id,
        title: `Study: ${task?.title ?? "session"}`,
        startMin: session.startMin,
        endMin: session.endMin,
        minutes: Math.max(0, session.endMin - session.startMin),
        tone: "homework" as const,
        detail: session.focus,
        study: true,
      };
    });
}

export function todayScheduleRows(state: AppState, now = new Date()): CompactBlock[] {
  const day = startOfDay(now);
  const dateKey = toISODate(day);
  const study = (state.studySessions ?? [])
    .filter(
      (session) =>
        session.dateKey === dateKey &&
        !session.completed &&
        !session.skipped &&
        session.endMin > session.startMin,
    )
    .map((session) => {
      const task = state.tasks.find((item) => item.id === session.taskId);
      return {
        id: session.id,
        title: `Study: ${task?.title ?? "session"}`,
        startMin: session.startMin,
        endMin: session.endMin,
        minutes: Math.max(0, session.endMin - session.startMin),
        tone: "homework" as const,
        detail: session.focus,
        study: true,
      };
    });

  const rows: CompactBlock[] = [...eventBlocksOnDay(state, day), ...study];

  for (const span of dayFreeSpans(state, day)) {
    rows.push({
      id: `free-${span.startMin}`,
      title: span.startMin >= EVENING_START ? "Free evening" : "Free time",
      startMin: span.startMin,
      endMin: span.endMin,
      minutes: span.minutes,
      tone: "free",
    });
  }

  if (rows.length === 0) return [];

  return rows.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

export function compactBlocksForDay(
  state: AppState,
  day: Date,
  now = new Date(),
): CompactBlock[] {
  const events = eventsOnDay(state, day);
  const blocks: CompactBlock[] = [...eventBlocksOnDay(state, day)];

  const dueToday = state.tasks
    .filter(
      (task) =>
        !task.completed &&
        !isExamTask(task) &&
        !(state.studySessions ?? []).some((session) => session.taskId === task.id && !session.skipped) &&
        (task.remainingMinutes || task.estimatedMinutes) > 0 &&
        toISODate(new Date(task.dueAt)) === toISODate(day),
    )
    .sort((a, b) => scheduleRank(a, now) - scheduleRank(b, now));

  const evening = firstEveningSlot(state, day);
  let cursor = evening?.startMin ?? 17 * 60;
  const eveningEnd = evening?.endMin ?? 22 * 60;
  for (const task of dueToday.slice(0, 2)) {
    const needed = task.remainingMinutes || task.estimatedMinutes || 30;
    const remaining = Math.max(0, eveningEnd - cursor);
    const fits = needed <= remaining && remaining >= 20;
    const take = fits ? needed : Math.max(20, remaining);
    blocks.push({
      id: `hw-${task.id}`,
      title: fits ? task.title : `${task.title} (conflict)`,
      startMin: cursor,
      endMin: cursor + take,
      minutes: needed,
      tone: fits ? "homework" : "risk",
      detail: neededLabel(needed),
    });
    cursor += take + 10;
  }

  blocks.push(...studyBlocksForDay(state, day));

  const open =
    events.length === 0 &&
    dueToday.length === 0;
  if (!open) {
    const best = longestEveningSlot(state, day);
    if (best) {
      const startMin = snapFreeStart(dueToday.length > 0 ? Math.max(best.startMin, cursor) : best.startMin);
      const endMin = snapFreeEnd(best.endMin);
      const minutes = endMin - startMin;
      if (minutes >= 20) {
        blocks.push({
          id: `free-${toISODate(day)}-${startMin}`,
          title: "Free time",
          startMin,
          endMin,
          minutes,
          tone: "free",
          bestWindow: true,
          detail: hoursPhrase(minutes),
        });
      }
    }
  }

  return blocks.sort((a, b) => a.startMin - b.startMin);
}

export function homeworkConflictForDay(state: AppState, day: Date, now = new Date()) {
  const dueToday = state.tasks.filter(
    (task) =>
      !task.completed &&
      !isExamTask(task) &&
      !(state.studySessions ?? []).some((session) => session.taskId === task.id && !session.skipped) &&
      (task.remainingMinutes || task.estimatedMinutes) > 0 &&
      toISODate(new Date(task.dueAt)) === toISODate(day),
  );
  if (dueToday.length === 0) return null;
  const evening = firstEveningSlot(state, day);
  const free = evening ? evening.endMin - evening.startMin : 0;
  const needed = dueToday.reduce(
    (sum, task) => sum + (task.remainingMinutes || task.estimatedMinutes || 0),
    0,
  );
  const worst = [...dueToday].sort(
    (a, b) =>
      (b.remainingMinutes || b.estimatedMinutes) - (a.remainingMinutes || a.estimatedMinutes),
  )[0];
  if (needed <= free) return null;
  return {
    name: worst.title,
    needed,
    free,
  };
}

export function dayDot(state: AppState, day: Date, now = new Date()): DayDot {
  if (dayHasConflict(state, day, now)) return "conflict";
  const events = eventsOnDay(state, day);
  const homeworkDue = state.tasks.some(
    (task) =>
      !task.completed && toISODate(new Date(task.dueAt)) === toISODate(day),
  );
  if (events.some((event) => event.category !== "school") || homeworkDue) return "activity";
  if (studyBlocksForDay(state, day).length > 0) return "activity";
  if (!isAcademicSchoolDay(state, day) && events.length === 0) return "off";
  return "free";
}

export function dayHasConflict(state: AppState, day: Date, now = new Date()): boolean {
  const key = toISODate(day);
  if (detectAllTimeConflicts(state, now).some((hit) => hit.dateKey === key)) return true;
  return homeworkConflictForDay(state, day, now) != null;
}

export function weekDays(now = new Date()) {
  const start = startOfWeek(now);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthGridDays(month: Date) {
  const start = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export type MonthChip = {
  id: string;
  label: string;
  tone: CompactTone;
};

export function activityChipsForDay(state: AppState, day: Date): MonthChip[] {
  const chips: MonthChip[] = [];
  for (const event of eventsOnDay(state, day)) {
    chips.push({
      id: event.id,
      label: event.title,
      tone: eventTone(event.category),
    });
  }
  for (const block of studyBlocksForDay(state, day)) {
    chips.push({ id: block.id, label: block.title, tone: "homework" });
  }
  const key = toISODate(day);
  for (const task of state.tasks) {
    if (task.completed) continue;
    if (toISODate(new Date(task.dueAt)) !== key) continue;
    chips.push({ id: `due-${task.id}`, label: `Due: ${task.title}`, tone: "risk" });
  }
  return chips;
}

export function freeMinutesLabel(minutes: number): string {
  return `${hoursNice(minutes)} free`;
}

export function isOpenCalendarDay(state: AppState, day: Date): boolean {
  const events = eventsOnDay(state, day);
  const homeworkDue = state.tasks.some(
    (task) =>
      !task.completed &&
      (task.remainingMinutes || task.estimatedMinutes) > 0 &&
      toISODate(new Date(task.dueAt)) === toISODate(day),
  );
  return events.length === 0 && !homeworkDue && studyBlocksForDay(state, day).length === 0;
}
