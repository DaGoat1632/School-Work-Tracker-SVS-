import { formatClock, formatDuration } from "./format";
import {
  addDays,
  hoursUntil,
  startOfDay,
  toISODate,
  weekday,
  minutesFromMidnight,
  isWeekend,
} from "./time";
import type {
  AppState,
  FixedEvent,
  FreeSize,
  PlanningNotification,
  ScheduledBlock,
  StudySession,
  Task,
  ReminderUrgency,
} from "./types";

export type Occupancy = {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  kind: "event" | "work" | "travel";
};

export type TimeConflict = {
  dateKey: string;
  date: Date;
  left: Occupancy;
  right: Occupancy;
  overlapMinutes: number;
};

export type FreeSlot = {
  date: Date;
  dateKey: string;
  startMin: number;
  endMin: number;
  minutes: number;
  size: FreeSize;
};

export type BlockUse = {
  taskId: string;
  title: string;
  minutes: number;
  startMin: number;
  endMin: number;
  emoji: string;
};

export type FreeBlockPlan = {
  slot: FreeSlot;
  headline: string;
  sizeLabel: string;
  uses: BlockUse[];
  leftoverMinutes: number;
};

export type PlanningStatus = "behind" | "on_track" | "ahead";
export type TrackState = "on_track" | "needs_planning" | "at_risk" | "overdue";

export type SessionSuggestion = {
  taskId: string;
  title: string;
  date: Date;
  dateKey: string;
  minutes: number;
  startMin?: number;
  endMin?: number;
  label: string;
};

export type StudyPlan = {
  task: Task;
  recommendedMinutes: number;
  plannedMinutes: number;
  remainingMinutes: number;
  enough: boolean;
  sessions: SessionSuggestion[];
};

export type TaskPlan = {
  task: Task;
  needed: number;
  planned: number;
  remaining: number;
  enough: boolean;
  status: PlanningStatus;
  track: TrackState;
  sessions: SessionSuggestion[];
  availableBeforeDeadline: number;
  shortBy: number;
  atRisk: boolean;
};

export type BreakBlock = {
  date: Date;
  dateKey: string;
  startMin: number;
  endMin: number;
  minutes: number;
  label: string;
};

export type CoachItem = {
  kind: "work" | "break" | "free" | "personal";
  startMin: number;
  endMin: number;
  minutes: number;
  title: string;
  emoji: string;
  taskId?: string;
  period?: string;
};

export type DailySummary = {
  windowStart: number;
  windowEnd: number;
  windowMinutes: number;
  eventMinutes: number;
  workMinutes: number;
  breakMinutes: number;
  personalMinutes: number;
  freeMinutes: number;
};

export type CoachDayPlan = {
  date: Date;
  dateKey: string;
  workMinutes: number;
  breakMinutes: number;
  freeMinutes: number;
  personalMinutes: number;
  eventMinutes: number;
  windowMinutes: number;
  urgentCount: number;
  testCount: number;
  items: CoachItem[];
  headline: string;
  leftover: CoachItem | null;
  summary: DailySummary;
};

export type SmartSchedule = {
  plans: TaskPlan[];
  breaks: BreakBlock[];
};

type OpenSpan = { startMin: number; endMin: number };

export type DeadlineItem = {
  kind: "due" | "test" | "event" | "free";
  title: string;
  detail: string;
};

export type DeadlineDay = {
  date: Date;
  dateKey: string;
  items: DeadlineItem[];
};

type EventDraft = Omit<FixedEvent, "id"> & { id?: string };

function clampMin(value: number): number {
  return Math.max(0, Math.min(24 * 60, value));
}

function eventMatchesDay(event: Pick<FixedEvent, "daysOfWeek" | "specificDate">, day: Date): boolean {
  if (event.specificDate) return event.specificDate.slice(0, 10) === toISODate(day);
  return event.daysOfWeek.includes(weekday(day));
}

function spanForTimes(startTime: string, endTime: string, travelBefore: number, travelAfter: number) {
  let start = minutesFromMidnight(startTime) - (travelBefore || 0);
  let end = minutesFromMidnight(endTime) + (travelAfter || 0);
  if (end <= start) end += 24 * 60;
  return { start: clampMin(start), end: Math.min(end, 24 * 60 + 12 * 60) };
}

export function occupanciesForEvent(event: EventDraft, day: Date): Occupancy[] {
  if (!eventMatchesDay(event, day)) return [];
  const { start, end } = spanForTimes(
    event.startTime,
    event.endTime,
    event.travelMinutesBefore,
    event.travelMinutesAfter,
  );
  const id = event.id ?? "draft";
  return [
    {
      id,
      title: event.title,
      startMin: start,
      endMin: Math.min(end, 24 * 60),
      kind: "event",
    },
  ];
}

function occupanciesForBlocks(blocks: ScheduledBlock[], day: Date): Occupancy[] {
  const key = toISODate(day);
  return blocks
    .filter((block) => block.status !== "skipped" && toISODate(new Date(block.start)) === key)
    .map((block) => {
      const start = new Date(block.start);
      const end = new Date(block.end);
      let startMin = start.getHours() * 60 + start.getMinutes();
      let endMin = end.getHours() * 60 + end.getMinutes();
      if (endMin <= startMin) endMin = startMin + Math.max(block.minutes, 15);
      return {
        id: block.id,
        title: block.title,
        startMin,
        endMin,
        kind: "work" as const,
      };
    });
}

function occupanciesForSessions(
  sessions: StudySession[],
  day: Date,
  taskTitles: Record<string, string> = {},
): Occupancy[] {
  const key = toISODate(day);
  return sessions
    .filter((session) => !session.skipped && session.dateKey === key)
    .map((session) => {
      const name = taskTitles[session.taskId] || session.focus || "Study session";
      return {
        id: session.id,
        title: taskTitles[session.taskId] ? `Study: ${name}` : name,
        startMin: session.startMin,
        endMin: session.endMin,
        kind: "work" as const,
      };
    });
}

function overlapMinutes(a: Occupancy, b: Occupancy): number {
  const start = Math.max(a.startMin, b.startMin);
  const end = Math.min(a.endMin, b.endMin);
  return Math.max(0, end - start);
}

function clockRange(startMin: number, endMin: number): string {
  const toTime = (minutes: number) => {
    const wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const hours = Math.floor(wrapped / 60);
    const mins = wrapped % 60;
    return formatClock(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
  };
  return `${toTime(startMin)}–${toTime(endMin)}`;
}

export function detectTimeConflicts(
  candidate: EventDraft,
  events: FixedEvent[],
  studySessions: StudySession[] = [],
  now = new Date(),
  taskTitles: Record<string, string> = {},
): TimeConflict[] {
  const conflicts: TimeConflict[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 14; i += 1) {
    const day = addDays(startOfDay(now), i);
    if (!eventMatchesDay(candidate, day)) continue;
    const lefts = occupanciesForEvent(candidate, day);
    const rights = [
      ...events.flatMap((event) =>
        event.id && event.id === candidate.id ? [] : occupanciesForEvent(event, day),
      ),
      ...occupanciesForSessions(studySessions, day, taskTitles),
    ];
    for (const left of lefts) {
      for (const right of rights) {
        const overlap = overlapMinutes(left, right);
        if (overlap < 5) continue;
        const key = `${toISODate(day)}:${[left.id, right.id].sort().join(":")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        conflicts.push({
          dateKey: toISODate(day),
          date: day,
          left,
          right,
          overlapMinutes: overlap,
        });
      }
    }
  }
  return conflicts;
}

function taskTitleMap(tasks: Task[]): Record<string, string> {
  return Object.fromEntries(tasks.map((task) => [task.id, task.title]));
}

export function detectAllTimeConflicts(state: AppState, now = new Date()): TimeConflict[] {
  const conflicts: TimeConflict[] = [];
  const seen = new Set<string>();
  const titles = taskTitleMap(state.tasks);
  for (const event of state.events) {
    for (const hit of detectTimeConflicts(event, state.events, state.studySessions ?? [], now, titles)) {
      const key = `${hit.dateKey}:${[hit.left.id, hit.right.id].sort().join(":")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push(hit);
    }
  }
  return conflicts;
}

export function formatConflictMessage(conflict: TimeConflict): string {
  return `Time conflict\n${conflict.left.title}: ${clockRange(conflict.left.startMin, conflict.left.endMin)}\n${conflict.right.title}: ${clockRange(conflict.right.startMin, conflict.right.endMin)}\nYou have a ${formatDuration(conflict.overlapMinutes)} overlap.`;
}

function workWindow(state: AppState): { start: number; end: number } {
  const start = minutesFromMidnight(state.preferences.wakeTime);
  const sleep = minutesFromMidnight(state.preferences.sleepTime);
  const cutoff = minutesFromMidnight(state.preferences.noWorkAfter);
  const end = Math.min(sleep > start ? sleep : 24 * 60, cutoff > start ? cutoff : 24 * 60);
  return { start, end: Math.max(start + 15, end) };
}

function dayWorkWindow(state: AppState, day: Date): { start: number; end: number } {
  const base = workWindow(state);
  if (isWeekend(day)) return base;
  const afterSchool = schoolDayEnd(state, day) ?? 15 * 60 + 10;
  const start = Math.max(base.start, afterSchool);
  return { start, end: Math.max(start + 15, base.end) };
}

function schoolDayEnd(state: AppState, day: Date): number | null {
  const ends = state.events
    .filter((event) => event.category === "school" && eventMatchesDay(event, day))
    .flatMap((event) => occupanciesForEvent(event, day))
    .map((item) => item.endMin);
  return ends.length ? Math.max(...ends) : null;
}

/** Hours we are willing to recommend work — not the same as "awake and uncommitted." */
export function isAcademicSchoolDay(state: AppState, day: Date): boolean {
  return schoolDayEnd(state, day) != null;
}

export function recommendWindow(
  state: AppState,
  day: Date,
): { start: number; end: number } {
  const latest = Math.min(workWindow(state).end, 21 * 60);
  if (!isWeekend(day)) {
    const start = schoolDayEnd(state, day) ?? 15 * 60 + 10;
    return { start, end: Math.max(start + 20, latest) };
  }
  const start = 9 * 60;
  return { start, end: Math.max(start + 20, latest) };
}

export function getAvailableTimeBlocks(
  state: AppState,
  day: Date,
  options?: { includeWorkBlocks?: boolean; now?: Date },
): FreeSlot[] {
  return calculateFreeTime(state, day, options);
}

export function calculateFreeTime(
  state: AppState,
  day: Date,
  options?: { includeWorkBlocks?: boolean; now?: Date },
): FreeSlot[] {
  const includeWork = options?.includeWorkBlocks ?? true;
  const clock = options?.now ?? new Date();
  const window = dayWorkWindow(state, day);
  const busy = [
    ...state.events.flatMap((event) => occupanciesForEvent(event, day)),
    ...(includeWork ? occupanciesForBlocks(state.blocks, day) : []),
  ].sort((a, b) => a.startMin - b.startMin);

  let cursor = window.start;
  if (toISODate(day) === toISODate(clock)) {
    cursor = Math.max(cursor, clock.getHours() * 60 + clock.getMinutes());
  }

  const merged: Occupancy[] = [];
  for (const item of busy) {
    const last = merged[merged.length - 1];
    if (last && item.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, item.endMin);
    } else {
      merged.push({ ...item });
    }
  }

  const slots: FreeSlot[] = [];
  for (const item of merged) {
    if (item.endMin <= window.start || item.startMin >= window.end) continue;
    const gapEnd = Math.min(item.startMin, window.end);
    if (gapEnd - cursor >= 15) {
      const minutes = gapEnd - cursor;
      slots.push({
        date: startOfDay(day),
        dateKey: toISODate(day),
        startMin: cursor,
        endMin: gapEnd,
        minutes,
        size: minutes >= 60 ? "long" : minutes >= 30 ? "medium" : "short",
      });
    }
    cursor = Math.max(cursor, Math.min(item.endMin, window.end));
  }
  if (window.end - cursor >= 15) {
    const minutes = window.end - cursor;
    slots.push({
      date: startOfDay(day),
      dateKey: toISODate(day),
      startMin: cursor,
      endMin: window.end,
      minutes,
      size: minutes >= 60 ? "long" : minutes >= 30 ? "medium" : "short",
    });
  }
  return slots;
}

export function freeSizeLabel(size: FreeSize): string {
  if (size === "long") return "Big Free Block";
  if (size === "medium") return "Free Time";
  return "Quick Free Time";
}

export function describeWhen(slot: FreeSlot, now = new Date()): string {
  const range = clockRange(slot.startMin, slot.endMin);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const day = startOfDay(slot.date);
  const evening = slot.startMin >= 17 * 60;
  if (toISODate(day) === toISODate(today)) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (slot.startMin <= nowMin + 15 && nowMin < slot.endMin) {
      return `You have ${formatDuration(slot.minutes)} free right now (${range})`;
    }
    if (evening) return `Tonight ${range} is free`;
    if (slot.startMin < 12 * 60) return `This morning ${range} is free`;
    return `Today ${range} is free`;
  }
  if (toISODate(day) === toISODate(tomorrow)) {
    return evening ? `Tomorrow night ${range} is free` : `Tomorrow ${range} is free`;
  }
  const weekdayName = day.toLocaleDateString([], { weekday: "long" });
  return `${weekdayName} ${range} is free`;
}

function taskEmoji(task: Task): string {
  if (task.type === "test" || task.type === "quiz") return "🧠";
  if (task.type === "project") return "🔬";
  if (task.type === "reading") return "📖";
  return "📚";
}

function workLeft(task: Task): number {
  if (task.completed) return 0;
  return Math.max(task.remainingMinutes || task.estimatedMinutes || 0, 0);
}

function openTasks(state: AppState, now = new Date()): Task[] {
  return [...state.tasks]
    .filter((task) => workLeft(task) > 0 && task.dueAt)
    .sort((a, b) => calculateTaskPriority(b, now) - calculateTaskPriority(a, now));
}

export function planFreeBlock(
  state: AppState,
  slot: FreeSlot,
  now = new Date(),
): FreeBlockPlan {
  const uses: BlockUse[] = [];
  let cursor = slot.startMin;
  let leftover = slot.minutes;
  const remaining = new Map(openTasks(state, now).map((task) => [task.id, workLeft(task)]));
  const blockCap = Math.max(25, Math.min(state.preferences.workBlockMinutes || 50, 60));

  for (const task of openTasks(state, now)) {
    if (leftover < 15) break;
    if (startOfDay(new Date(task.dueAt)) < startOfDay(slot.date)) continue;
    const left = remaining.get(task.id) ?? 0;
    if (left < 15) continue;
    const take = Math.min(left, leftover, leftover >= 90 ? blockCap : leftover);
    if (take < 15) continue;
    uses.push({
      taskId: task.id,
      title: task.title,
      minutes: take,
      startMin: cursor,
      endMin: cursor + take,
      emoji: taskEmoji(task),
    });
    cursor += take;
    leftover -= take;
    remaining.set(task.id, left - take);
  }

  return {
    slot,
    headline: describeWhen(slot, now),
    sizeLabel: freeSizeLabel(slot.size),
    uses,
    leftoverMinutes: leftover,
  };
}

function clipSpan(span: OpenSpan, minStart: number, maxEnd: number): OpenSpan | null {
  const start = Math.max(span.startMin, minStart);
  const end = Math.min(span.endMin, maxEnd);
  if (end - start < 15) return null;
  return { startMin: start, endMin: end };
}

function subtractBooked(spans: OpenSpan[], booked: OpenSpan): OpenSpan[] {
  const next: OpenSpan[] = [];
  for (const span of spans) {
    if (booked.endMin <= span.startMin || booked.startMin >= span.endMin) {
      next.push(span);
      continue;
    }
    if (booked.startMin - span.startMin >= 15) {
      next.push({ startMin: span.startMin, endMin: booked.startMin });
    }
    if (span.endMin - booked.endMin >= 15) {
      next.push({ startMin: booked.endMin, endMin: span.endMin });
    }
  }
  return next;
}

function spanMinutes(spans: OpenSpan[], minStart: number, maxEnd: number): number {
  return spans.reduce((sum, span) => {
    const clipped = clipSpan(span, minStart, maxEnd);
    return sum + (clipped ? clipped.endMin - clipped.startMin : 0);
  }, 0);
}

function dueCutoffMin(task: Task, day: Date): number {
  const due = new Date(task.dueAt);
  if (toISODate(day) < toISODate(due)) return 24 * 60;
  if (toISODate(day) > toISODate(due)) return 0;
  return due.getHours() * 60 + due.getMinutes();
}

function neededMinutes(task: Task): number {
  if (task.type === "test" || task.type === "quiz") {
    return Math.max(workLeft(task), recommendedStudyMinutes(task));
  }
  return workLeft(task);
}

export function scheduleRank(task: Task, now = new Date()): number {
  if (task.completed || workLeft(task) <= 0) return 99;
  const hours = hoursUntil(task.dueAt, now);
  const days = Math.round(
    (startOfDay(new Date(task.dueAt)).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  const isTest = task.type === "test" || task.type === "quiz";
  const needed = neededMinutes(task);
  if (hours < 0) return 0;
  if (days <= 0) return 1;
  if (days === 1) return 2;
  if (isTest && days <= 4) return 3;
  if (days <= 3) return 4;
  if ((task.type === "project" || needed >= 120) && days <= 7) return 5;
  if (isTest) return 6;
  return 7;
}

const MIN_WORK = 30;
const MIN_FINISH = 15;
const PERSONAL_START = 17 * 60;
const PERSONAL_END = 18 * 60;

function daysUntilDue(task: Task, now: Date): number {
  return Math.round(
    (startOfDay(new Date(task.dueAt)).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
}

const NICE_SESSION_LENGTHS = [30, 45, 60, 75, 90];

function isStudyTask(task: Task): boolean {
  return task.type === "test" || task.type === "quiz";
}

function isLargeTask(task: Task, needed: number): boolean {
  return isStudyTask(task) || task.type === "project" || needed >= 90;
}

function snapNiceSession(minutes: number): number {
  let best = NICE_SESSION_LENGTHS[0];
  let dist = Math.abs(best - minutes);
  for (const option of NICE_SESSION_LENGTHS) {
    const gap = Math.abs(option - minutes);
    if (gap < dist || (gap === dist && option >= minutes)) {
      best = option;
      dist = gap;
    }
  }
  return best;
}

function chooseSessionTake(left: number, room: number, target: number, cap: number): number {
  const maxTake = Math.min(left, room, cap);
  if (maxTake < MIN_FINISH) return 0;
  if (left <= maxTake && left < MIN_WORK) return left;
  const nice = NICE_SESSION_LENGTHS.filter((size) => size <= maxTake && size <= left);
  if (target <= maxTake && target <= left && NICE_SESSION_LENGTHS.includes(target)) {
    const leftover = left - target;
    if (leftover > 0 && leftover < MIN_FINISH && leftover <= maxTake - target) return target + leftover;
    return target;
  }
  if (nice.length > 0) {
    nice.sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || b - a);
    const pick = nice[0];
    const leftover = left - pick;
    if (leftover > 0 && leftover < MIN_FINISH && leftover <= maxTake - pick) return pick + leftover;
    return pick;
  }
  return maxTake;
}

function dailyShare(task: Task, now: Date, needed: number): number {
  const days = Math.max(1, daysUntilDue(task, now) + 1);
  const dueSoon = daysUntilDue(task, now) <= 1;
  if (dueSoon && !isStudyTask(task)) return needed;
  if (isStudyTask(task)) {
    const pieces = Math.min(Math.max(days - (daysUntilDue(task, now) >= 2 ? 1 : 0), 2), 4);
    return Math.max(MIN_WORK, Math.min(45, snapNiceSession(needed / pieces)));
  }
  if (isLargeTask(task, needed)) {
    const buffer = daysUntilDue(task, now) >= 2 ? 1 : 0;
    const usable = Math.max(1, days - buffer);
    const target = 60;
    const pieces = Math.min(usable, Math.max(1, Math.ceil(needed / target)));
    return Math.max(MIN_WORK, Math.min(90, snapNiceSession(needed / pieces)));
  }
  if (needed <= 60) return needed;
  return Math.max(MIN_WORK, Math.min(60, snapNiceSession(needed / Math.min(days, 3))));
}

function dayWorkLimit(state: AppState, day: Date, urgent: boolean): number {
  const cap = isWeekend(day)
    ? state.preferences.maxWeekendMinutes
    : state.preferences.maxWeeknightMinutes;
  return urgent ? cap : Math.min(cap, 120);
}

function breakAfter(workMinutes: number, focusedSoFar: number, pref: number): number {
  if (focusedSoFar + workMinutes >= 90) return Math.max(pref, 15);
  if (workMinutes >= 30) return Math.max(5, pref || 10);
  if (workMinutes >= 20) return 5;
  return 0;
}

function emptyPlan(task: Task): TaskPlan {
  return {
    task,
    needed: 0,
    planned: 0,
    remaining: 0,
    enough: true,
    status: "ahead",
    track: "on_track",
    sessions: [],
    availableBeforeDeadline: 0,
    shortBy: 0,
    atRisk: false,
  };
}

function placementInSpan(
  span: OpenSpan,
  takeMax: number,
  minStart: number,
  maxEnd: number,
  schoolDay: boolean,
): OpenSpan | null {
  const startBound = Math.max(span.startMin, minStart);
  const endBound = Math.min(span.endMin, maxEnd);
  const room = endBound - startBound;
  if (room < MIN_FINISH) return null;
  const take = Math.min(takeMax, room);
  if (take < MIN_FINISH) return null;
  if (take < MIN_WORK && take !== takeMax && take < takeMax) return null;
  const preferred = schoolDay
    ? [startBound, 16 * 60, 16 * 60 + 70, 18 * 60]
    : [9 * 60, 10 * 60, 11 * 60, 18 * 60, startBound];
  for (const candidate of preferred) {
    const start = Math.max(startBound, candidate);
    if (start + take <= endBound) return { startMin: start, endMin: start + take };
  }
  if (startBound + take <= endBound) {
    return { startMin: startBound, endMin: startBound + take };
  }
  return null;
}

function spanScore(startMin: number, schoolDay: boolean): number {
  if (schoolDay && startMin < 15 * 60 + 10) return -40;
  if (!schoolDay && startMin < 9 * 60) return -40;
  if (startMin >= PERSONAL_START && startMin < PERSONAL_END) return -10;
  if (schoolDay && startMin >= 15 * 60 + 10 && startMin < 17 * 60) return 90;
  if (!schoolDay && startMin >= 9 * 60 && startMin < 12 * 60) return 90;
  if (startMin >= 18 * 60 && startMin < 21 * 60) return 70;
  if (startMin >= 16 * 60) return 80;
  if (startMin >= 12 * 60) return 40;
  return -30;
}

function takeFromDay(
  spans: OpenSpan[],
  takeMax: number,
  minStart: number,
  maxEnd: number,
  schoolDay: boolean,
  preferStart?: number,
  allowShortFinish = false,
): { booked: OpenSpan; next: OpenSpan[] } | null {
  const minTake = allowShortFinish ? MIN_FINISH : MIN_WORK;
  if (preferStart != null && preferStart >= minStart) {
    for (const span of spans) {
      const start = Math.max(span.startMin, minStart, preferStart);
      const end = Math.min(span.endMin, maxEnd);
      const take = Math.min(takeMax, end - start);
      if (take >= minTake && start + take <= end) {
        const booked = { startMin: start, endMin: start + take };
        return { booked, next: subtractBooked(spans, booked) };
      }
    }
  }
  let best: { booked: OpenSpan; score: number } | null = null;
  for (const span of spans) {
    const booked = placementInSpan(span, takeMax, minStart, maxEnd, schoolDay);
    if (!booked) continue;
    if (booked.endMin - booked.startMin < minTake && !allowShortFinish) continue;
    const score =
      spanScore(booked.startMin, schoolDay) + Math.min(20, (span.endMin - span.startMin) / 15);
    if (!best || score > best.score) best = { booked, score };
  }
  if (!best) return null;
  return { booked: best.booked, next: subtractBooked(spans, best.booked) };
}

function sessionOverlaps(a: SessionSuggestion, b: SessionSuggestion): boolean {
  if (a.dateKey !== b.dateKey) return false;
  if (a.startMin == null || a.endMin == null || b.startMin == null || b.endMin == null) {
    return false;
  }
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function validateTaskPlannedDuration(
  requiredMinutes: number,
  sessions: SessionSuggestion[],
): { requiredMinutes: number; scheduledMinutes: number; remainingMinutes: number; complete: boolean } {
  const scheduledMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const remainingMinutes = Math.max(0, requiredMinutes - scheduledMinutes);
  return {
    requiredMinutes,
    scheduledMinutes,
    remainingMinutes,
    complete: remainingMinutes === 0,
  };
}

export function shortfallMinutes(
  remainingMinutes: number,
  availableMinutesBeforeDeadline: number,
): number {
  return Math.max(0, remainingMinutes - Math.max(0, availableMinutesBeforeDeadline));
}

export function classifyTaskTrack(input: {
  hoursUntilDue: number;
  remainingMinutes: number;
  availableMinutesBeforeDeadline: number;
}): { track: TrackState; shortfallMinutes: number } {
  const remaining = Math.max(0, input.remainingMinutes);
  const available = Math.max(0, input.availableMinutesBeforeDeadline);
  const shortfall = shortfallMinutes(remaining, available);
  if (input.hoursUntilDue < 0 && remaining > 0) {
    return { track: "overdue", shortfallMinutes: Math.max(shortfall, remaining) };
  }
  if (remaining <= 0) return { track: "on_track", shortfallMinutes: 0 };
  if (shortfall > 0) return { track: "at_risk", shortfallMinutes: shortfall };
  if (remaining >= MIN_FINISH) return { track: "needs_planning", shortfallMinutes: 0 };
  return { track: "on_track", shortfallMinutes: 0 };
}

export function validateRecommendedSessions(
  sessions: SessionSuggestion[],
  state: AppState,
  tasks: Task[],
  now = new Date(),
): SessionSuggestion[] {
  const valid: SessionSuggestion[] = [];
  for (const session of sessions) {
    if (session.startMin == null || session.endMin == null) continue;
    if (session.endMin - session.startMin < 15) continue;
    if (session.endMin - session.startMin !== session.minutes) continue;
    const window = recommendWindow(state, session.date);
    if (session.startMin < window.start || session.endMin > window.end) continue;
    const task = tasks.find((item) => item.id === session.taskId);
    if (!task || task.completed || workLeft(task) <= 0) continue;
    const cutoff = dueCutoffMin(task, session.date);
    if (session.endMin > cutoff) continue;
    const dueTime = new Date(task.dueAt).getTime();
    const startDate = new Date(session.date);
    startDate.setHours(0, 0, 0, 0);
    startDate.setMinutes(session.startMin);
    if (startDate.getTime() >= dueTime) continue;

    const busy = state.events.flatMap((event) => occupanciesForEvent(event, session.date));
    const booked: Occupancy = {
      id: `rec-${session.taskId}-${session.startMin}`,
      title: session.title,
      startMin: session.startMin,
      endMin: session.endMin,
      kind: "work",
    };
    if (busy.some((item) => overlapMinutes(item, booked) > 0)) continue;

    const original = calculateFreeTime(state, session.date, {
      now,
      includeWorkBlocks: false,
    });
    const insideFree = original.some(
      (slot) => session.startMin! >= slot.startMin && session.endMin! <= slot.endMin,
    );
    if (!insideFree) continue;
    if (valid.some((other) => sessionOverlaps(other, session))) continue;
    valid.push(session);
  }
  return valid;
}

function relabel(session: SessionSuggestion, task: Task, isLast: boolean) {
  if (session.startMin == null || session.endMin == null) return;
  session.minutes = session.endMin - session.startMin;
  session.label = `${clockRange(session.startMin, session.endMin)} — ${chunkLabel(task, session.minutes, isLast)}`;
}

function growSessionIntoSpans(
  session: SessionSuggestion,
  extra: number,
  spans: OpenSpan[],
  minStart: number,
  maxEnd: number,
): { grown: number; booked: OpenSpan } | null {
  if (extra <= 0 || session.startMin == null || session.endMin == null) return null;
  for (const span of spans) {
    const startBound = Math.max(span.startMin, minStart);
    const endBound = Math.min(span.endMin, maxEnd);
    if (session.endMin >= startBound && session.endMin < endBound) {
      const grown = Math.min(extra, endBound - session.endMin);
      if (grown > 0) {
        return {
          grown,
          booked: { startMin: session.endMin, endMin: session.endMin + grown },
        };
      }
    }
  }
  for (const span of spans) {
    const startBound = Math.max(span.startMin, minStart);
    const endBound = Math.min(span.endMin, maxEnd);
    if (session.startMin > startBound && session.startMin <= endBound) {
      const grown = Math.min(extra, session.startMin - startBound);
      if (grown > 0) {
        return {
          grown,
          booked: { startMin: session.startMin - grown, endMin: session.startMin },
        };
      }
    }
  }
  return null;
}

function absorbRemainingIntoSessions(
  leftover: number,
  sessions: SessionSuggestion[],
  availability: Map<string, OpenSpan[]>,
  task: Task,
  state: AppState,
  now: Date,
  workToday: Map<string, number>,
): number {
  let left = leftover;
  if (left <= 0 || sessions.length === 0) return left;
  const todayKey = toISODate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const ordered = [...sessions].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? 1 : -1;
    return (b.endMin ?? 0) - (a.endMin ?? 0);
  });
  for (const session of ordered) {
    if (left <= 0) break;
    if (session.startMin == null || session.endMin == null) continue;
    const window = recommendWindow(state, session.date);
    const dueEnd = dueCutoffMin(task, session.date);
    const minStart =
      session.dateKey === todayKey ? Math.max(window.start, nowMin) : window.start;
    const maxEnd = Math.min(window.end, dueEnd);
    const spans = availability.get(session.dateKey) ?? [];
    const grown = growSessionIntoSpans(session, left, spans, minStart, maxEnd);
    if (!grown) continue;
    if (grown.booked.startMin < session.startMin) session.startMin = grown.booked.startMin;
    if (grown.booked.endMin > session.endMin) session.endMin = grown.booked.endMin;
    availability.set(session.dateKey, subtractBooked(spans, grown.booked));
    left -= grown.grown;
    workToday.set(session.dateKey, (workToday.get(session.dateKey) ?? 0) + grown.grown);
    relabel(session, task, left === 0);
  }
  return left;
}

function insertBreaksBetweenWork(
  plans: TaskPlan[],
  state: AppState,
  now: Date,
  prefBreak: number,
): BreakBlock[] {
  const breaks: BreakBlock[] = [];
  const byDay = new Map<string, SessionSuggestion[]>();
  for (const plan of plans) {
    for (const session of plan.sessions) {
      if (session.startMin == null || session.endMin == null) continue;
      const list = byDay.get(session.dateKey) ?? [];
      list.push(session);
      byDay.set(session.dateKey, list);
    }
  }

  for (const [dateKey, list] of byDay) {
    list.sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0));
    const day = list[0]?.date;
    if (!day) continue;
    const window = recommendWindow(state, day);
    let focused = 0;
    for (let i = 0; i < list.length - 1; i += 1) {
      const current = list[i];
      const next = list[i + 1];
      if (current.endMin == null || next.startMin == null) continue;
      const need = breakAfter(current.minutes, focused, prefBreak);
      focused += current.minutes;
      if (need < 5) continue;
      if (next.startMin !== current.endMin) continue;
      const later = list.slice(i + 1);
      const last = later[later.length - 1];
      if (last.endMin == null) continue;
      const shiftedEnd = last.endMin + need;
      if (shiftedEnd > window.end) continue;
      const original = calculateFreeTime(state, day, { now, includeWorkBlocks: false });
      const fits = original.some(
        (slot) => current.endMin! >= slot.startMin && shiftedEnd <= slot.endMin,
      );
      if (!fits) continue;
      if (next.startMin < current.endMin) continue;
      for (const session of later) {
        if (session.startMin == null || session.endMin == null) continue;
        session.startMin += need;
        session.endMin += need;
        const task = state.tasks.find((item) => item.id === session.taskId);
        if (task) relabel(session, task, false);
      }
      breaks.push({
        date: day,
        dateKey,
        startMin: current.endMin,
        endMin: current.endMin + need,
        minutes: need,
        label:
          focused >= 90
            ? `☕ ${need}-minute break · stretch / grab water`
            : `☕ ${need}-minute break`,
      });
    }
  }
  return breaks;
}

export function buildSmartSchedule(state: AppState, now = new Date()): SmartSchedule {
  const today = startOfDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const prefBreak = Math.max(0, state.preferences.breakMinutes || 10);
  const availability = new Map<string, OpenSpan[]>();
  const workToday = new Map<string, number>();
  const urgentSoon = state.tasks.some(
    (task) => !task.completed && neededMinutes(task) > 0 && daysUntilDue(task, now) <= 1,
  );

  for (let offset = 0; offset <= 14; offset += 1) {
    const day = addDays(today, offset);
    const window = recommendWindow(state, day);
    availability.set(
      toISODate(day),
      subtractBooked(
        calculateFreeTime(state, day, { now, includeWorkBlocks: false })
          .map((slot) => ({ startMin: slot.startMin, endMin: slot.endMin }))
          .map((span) => clipSpan(span, window.start, window.end))
          .filter((span): span is OpenSpan => Boolean(span)),
        { startMin: PERSONAL_START, endMin: PERSONAL_END },
      ),
    );
  }

  const ranked = [...state.tasks]
    .filter((task) => !task.completed && neededMinutes(task) > 0 && task.dueAt)
    .sort((a, b) => {
      const rank = scheduleRank(a, now) - scheduleRank(b, now);
      if (rank !== 0) return rank;
      const due = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (due !== 0) return due;
      return calculateTaskPriority(b, now) - calculateTaskPriority(a, now);
    });

  const plans: TaskPlan[] = [];
  const placed: SessionSuggestion[] = [];

  for (const task of ranked) {
    const needed = neededMinutes(task);
    const lastDay = startOfDay(new Date(task.dueAt));
    const hours = hoursUntil(task.dueAt, now);
    const study = isStudyTask(task);
    const share = dailyShare(task, now, needed);
    const blockPref = Math.max(MIN_WORK, Math.min(state.preferences.workBlockMinutes || 50, 60));

    let availableBeforeDeadline = 0;
    for (let offset = 0; offset <= 14; offset += 1) {
      const day = addDays(today, offset);
      if (day > lastDay) break;
      const window = recommendWindow(state, day);
      const dueEnd = dueCutoffMin(task, day);
      const minStart = toISODate(day) === toISODate(today) ? Math.max(window.start, nowMin) : window.start;
      availableBeforeDeadline += spanMinutes(
        availability.get(toISODate(day)) ?? [],
        minStart,
        Math.min(window.end, dueEnd),
      );
    }

    let left = needed;
    const sessions: SessionSuggestion[] = [];
    const large = isLargeTask(task, needed);
    const sessionCap = study ? Math.min(blockPref, 45) : 90;
    const gap = Math.max(prefBreak, 10);
    const useBuffer = large && daysUntilDue(task, now) >= 2;
    const spreadUntil = useBuffer ? addDays(lastDay, -1) : lastDay;
    const lastSpread = spreadUntil < today ? lastDay : spreadUntil;

    const longestRoom = (dateKey: string, minStart: number, maxEnd: number) => {
      let best = 0;
      for (const span of availability.get(dateKey) ?? []) {
        const clipped = clipSpan(span, minStart, maxEnd);
        if (clipped) best = Math.max(best, clipped.endMin - clipped.startMin);
      }
      return best;
    };

    const placeOnDay = (day: Date, mode: "spread" | "fill" | "double") => {
      if (left < MIN_FINISH) return false;
      const dateKey = toISODate(day);
      const window = recommendWindow(state, day);
      const dueEnd = dueCutoffMin(task, day);
      if (dueEnd <= window.start) return false;
      const schoolDay = isAcademicSchoolDay(state, day);
      const minStart = dateKey === toISODate(today) ? Math.max(window.start, nowMin) : window.start;
      const maxEnd = Math.min(window.end, dueEnd);
      if (maxEnd - minStart < MIN_FINISH) return false;
      const limit = Math.min(
        dayWorkLimit(state, day, urgentSoon || daysUntilDue(task, now) <= 1),
        large ? 120 : 180,
      );
      let usedDay = workToday.get(dateKey) ?? 0;
      const alreadyForTask = sessions.filter((session) => session.dateKey === dateKey).length;
      if (mode !== "double" && alreadyForTask >= 1) return false;
      if (alreadyForTask >= 2) return false;
      if (usedDay >= limit) return false;

      const finishing = left < MIN_WORK;
      const room = longestRoom(dateKey, minStart, maxEnd);
      const usable = Math.min(room, Math.max(0, limit - usedDay));
      const takeMax =
        task.canSplit === false
          ? left <= usable
            ? left
            : 0
          : chooseSessionTake(
              left,
              usable,
              finishing ? left : share,
              finishing ? left : sessionCap,
            );
      if (takeMax < MIN_WORK && !(finishing && takeMax >= MIN_FINISH)) return false;
      if (takeMax <= 0) return false;

      const own = sessions
        .filter((session) => session.dateKey === dateKey && session.endMin != null)
        .sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0));
      const preferStart = own.length ? own[own.length - 1].endMin! + gap : undefined;
      const taken = takeFromDay(
        availability.get(dateKey) ?? [],
        takeMax,
        minStart,
        maxEnd,
        schoolDay,
        preferStart,
        finishing,
      );
      if (!taken) return false;
      const minutes = taken.booked.endMin - taken.booked.startMin;
      if (minutes < MIN_WORK && !finishing) return false;
      if (minutes < MIN_FINISH) return false;
      availability.set(dateKey, taken.next);
      left -= minutes;
      usedDay += minutes;
      workToday.set(dateKey, usedDay);
      sessions.push({
        taskId: task.id,
        title: task.title,
        date: day,
        dateKey,
        minutes,
        startMin: taken.booked.startMin,
        endMin: taken.booked.endMin,
        label: `${clockRange(taken.booked.startMin, taken.booked.endMin)} — ${chunkLabel(task, minutes, left === 0)}`,
      });
      return true;
    };

    const walkDays = (until: Date, mode: "spread" | "fill" | "double") => {
      for (let offset = 0; offset <= 14 && left >= MIN_FINISH; offset += 1) {
        const day = addDays(today, offset);
        if (day > until) break;
        placeOnDay(day, mode);
      }
    };

    walkDays(lastSpread, "spread");
    walkDays(lastSpread, "fill");
    let guard = 0;
    while (left >= MIN_FINISH && guard < 20) {
      guard += 1;
      const before = left;
      walkDays(lastSpread, "double");
      if (left === before) break;
    }
    if (left >= MIN_FINISH && lastDay > lastSpread) {
      walkDays(lastDay, "spread");
      walkDays(lastDay, "fill");
      walkDays(lastDay, "double");
    }
    left = absorbRemainingIntoSessions(left, sessions, availability, task, state, now, workToday);
    if (left >= MIN_FINISH) {
      walkDays(lastDay, "double");
      left = absorbRemainingIntoSessions(left, sessions, availability, task, state, now, workToday);
    }

    const valid = validateRecommendedSessions(
      [...placed, ...sessions],
      state,
      state.tasks,
      now,
    ).filter((session) => session.taskId === task.id);
    placed.push(...valid);
    const duration = validateTaskPlannedDuration(needed, valid);
    let leftoverCapacity = 0;
    for (let offset = 0; offset <= 14; offset += 1) {
      const day = addDays(today, offset);
      if (day > lastDay) break;
      const window = recommendWindow(state, day);
      const dueEnd = dueCutoffMin(task, day);
      const minStart = toISODate(day) === toISODate(today) ? Math.max(window.start, nowMin) : window.start;
      leftoverCapacity += spanMinutes(
        availability.get(toISODate(day)) ?? [],
        minStart,
        Math.min(window.end, dueEnd),
      );
    }
    const classified = classifyTaskTrack({
      hoursUntilDue: hours,
      remainingMinutes: duration.remainingMinutes,
      availableMinutesBeforeDeadline: leftoverCapacity,
    });
    const atRisk = classified.track === "at_risk" || classified.track === "overdue";
    plans.push({
      task,
      needed,
      planned: duration.scheduledMinutes,
      remaining: duration.remainingMinutes,
      enough: !atRisk,
      status: atRisk ? "behind" : "on_track",
      track: classified.track,
      sessions: valid,
      availableBeforeDeadline,
      shortBy: classified.shortfallMinutes,
      atRisk,
    });
  }

  const breaks = insertBreaksBetweenWork(plans, state, now, prefBreak);
  for (const plan of plans) {
    const duration = validateTaskPlannedDuration(plan.needed, plan.sessions);
    plan.planned = duration.scheduledMinutes;
    plan.remaining = duration.remainingMinutes;
    const hoursLeft = hoursUntil(plan.task.dueAt, now);
    if (hoursLeft < 0 && duration.remainingMinutes > 0) {
      plan.track = "overdue";
      plan.atRisk = true;
      plan.enough = false;
      plan.status = "behind";
      continue;
    }
    if (duration.remainingMinutes <= 0) {
      plan.track = "on_track";
      plan.shortBy = 0;
      plan.atRisk = false;
      plan.enough = true;
      plan.status = "on_track";
    }
  }
  return { plans, breaks };
}

export function buildReservedSchedule(state: AppState, now = new Date()): TaskPlan[] {
  return buildSmartSchedule(state, now).plans;
}

export function findBestWorkBlocks(
  task: Task,
  state: AppState,
  now = new Date(),
): SessionSuggestion[] {
  return createTaskPlan(task, state, now).sessions;
}

export function createTaskPlan(task: Task, state: AppState, now = new Date()): TaskPlan {
  if (task.completed || neededMinutes(task) <= 0) return emptyPlan(task);
  return (
    buildReservedSchedule(state, now).find((plan) => plan.task.id === task.id) ?? emptyPlan(task)
  );
}

export function createStudyPlan(task: Task, state: AppState, now = new Date()) {
  return recommendStudySessions(task, state, now);
}

export function detectScheduleConflicts(state: AppState, now = new Date()) {
  return detectAllTimeConflicts(state, now);
}

export function getPlanningStatus(
  task: Task,
  state: AppState,
  now = new Date(),
): PlanningStatus {
  return createTaskPlan(task, state, now).status;
}

export function recommendedStudyMinutes(task: Task): number {
  const estimate = Number.isFinite(task.estimatedMinutes) ? task.estimatedMinutes : 0;
  if (task.type === "test" || task.type === "quiz") {
    return Math.max(estimate || 0, estimate > 0 ? estimate : 120);
  }
  return estimate > 0 ? estimate : 45;
}

export function calculateTaskPriority(task: Task, now = new Date()): number {
  if (task.completed) return 0;
  const remaining = Math.max(task.remainingMinutes || task.estimatedMinutes || 0, 0);
  const hours = hoursUntil(task.dueAt, now);
  let score = 0;
  if (hours < 0) score += 40;
  else if (hours < 24) score += 25;
  else if (hours < 48) score += 15;
  else if (hours < 24 * 7) score += 8;
  if (task.type === "test" || task.type === "quiz") score += 20;
  if (task.type === "project") score += 8;
  score += Math.min(20, remaining / 30);
  if (task.priority === "high" || task.difficulty === "hard") score += 10;
  else if (task.priority === "medium" || task.difficulty === "medium") score += 5;
  if (task.priority === "low") score -= 4;
  return Math.round(score);
}

function chunkLabel(task: Task, minutes: number, isLast: boolean): string {
  if ((task.type === "test" || task.type === "quiz") && isLast) {
    return `${minutes} min review`;
  }
  return `${minutes} min`;
}

export function recommendTaskSessions(
  task: Task,
  state: AppState,
  now = new Date(),
): SessionSuggestion[] {
  const fromPlan = state.blocks
    .filter((block) => block.taskId === task.id && block.status !== "skipped")
    .map((block) => {
      const start = new Date(block.start);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const end = new Date(block.end);
      const endMin = end.getHours() * 60 + end.getMinutes();
      return {
        taskId: task.id,
        title: task.title,
        date: startOfDay(start),
        dateKey: toISODate(start),
        minutes: block.minutes,
        startMin,
        endMin,
        label: `${clockRange(startMin, endMin)} — ${block.minutes} min`,
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime() || (a.startMin ?? 0) - (b.startMin ?? 0));
  if (fromPlan.length > 0) return fromPlan;
  return findBestWorkBlocks(task, state, now);
}

export function recommendStudySessions(
  task: Task,
  state: AppState,
  now = new Date(),
): StudyPlan {
  const plan = createTaskPlan(task, state, now);
  const recommendedMinutes = neededMinutes(task);
  return {
    task,
    recommendedMinutes,
    plannedMinutes: plan.planned,
    remainingMinutes: plan.remaining,
    enough: plan.enough,
    sessions: plan.sessions,
  };
}

export function tasksDueOnDay(state: AppState, day: Date): Task[] {
  const dateKey = toISODate(day);
  return state.tasks.filter(
    (task) =>
      !task.completed &&
      Boolean(task.dueAt) &&
      workLeft(task) > 0 &&
      toISODate(new Date(task.dueAt)) === dateKey,
  );
}

export function getUpcomingDeadlines(state: AppState, now = new Date()): DeadlineDay[] {
  const days: DeadlineDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(startOfDay(now), i);
    const dateKey = toISODate(date);
    const items: DeadlineItem[] = [];
    for (const task of state.tasks) {
      if (task.completed || !task.dueAt) continue;
      if (toISODate(new Date(task.dueAt)) !== dateKey) continue;
      const isTest = task.type === "test" || task.type === "quiz";
      items.push({
        kind: isTest ? "test" : "due",
        title: task.title,
        detail: isTest ? "test" : "due",
      });
    }
    for (const event of state.events) {
      if (!eventMatchesDay(event, date)) continue;
      if (event.category === "school") continue;
      items.push({
        kind: "event",
        title: event.title,
        detail: clockRange(
          minutesFromMidnight(event.startTime),
          minutesFromMidnight(event.endTime),
        ),
      });
    }
    const free = calculateFreeTime(state, date, { now });
    const afternoon = free.filter((slot) => slot.startMin >= 15 * 60 && slot.minutes >= 90);
    if (items.filter((item) => item.kind === "event").length === 0 && afternoon.length > 0) {
      items.push({
        kind: "free",
        title: "Open/free afternoon",
        detail: formatDuration(afternoon.reduce((sum, slot) => sum + slot.minutes, 0)),
      });
    }
    days.push({ date, dateKey, items });
  }
  return days;
}

function mergeSpans(spans: OpenSpan[]): OpenSpan[] {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin);
  const out: OpenSpan[] = [];
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

function freeLabel(startMin: number): { title: string; emoji: string } {
  if (startMin >= 18 * 60) return { title: "Free evening", emoji: "🟢" };
  if (startMin >= 12 * 60) return { title: "Free afternoon", emoji: "🟢" };
  if (startMin >= 9 * 60) return { title: "Free morning", emoji: "🟢" };
  return { title: "Free time", emoji: "🟢" };
}

export function calculateDailySummary(items: CoachItem[], window: { start: number; end: number }): DailySummary {
  const workMinutes = items.filter((item) => item.kind === "work").reduce((sum, item) => sum + item.minutes, 0);
  const breakMinutes = items.filter((item) => item.kind === "break").reduce((sum, item) => sum + item.minutes, 0);
  const personalMinutes = items.filter((item) => item.kind === "personal").reduce((sum, item) => sum + item.minutes, 0);
  const freeMinutes = items.filter((item) => item.kind === "free").reduce((sum, item) => sum + item.minutes, 0);
  const eventMinutes = items.filter((item) => item.kind === "event" as CoachItem["kind"]).reduce((sum, item) => sum + item.minutes, 0);
  return {
    windowStart: window.start,
    windowEnd: window.end,
    windowMinutes: Math.max(0, window.end - window.start),
    eventMinutes,
    workMinutes,
    breakMinutes,
    personalMinutes,
    freeMinutes,
  };
}

export function validateDailyPlan(plan: CoachDayPlan, schoolDay = false): string[] {
  const errors: string[] = [];
  const items = [...plan.items].sort((a, b) => a.startMin - b.startMin);
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.endMin <= item.startMin) errors.push(`${item.title} has invalid times`);
    if (item.minutes !== item.endMin - item.startMin) errors.push(`${item.title} minutes mismatch`);
    const next = items[i + 1];
    if (next && item.endMin > next.startMin) errors.push(`${item.title} overlaps ${next.title}`);
    if (item.kind === "work" && item.startMin < 9 * 60) errors.push(`${item.title} starts before 9:00`);
    if (schoolDay && item.kind === "work" && item.startMin < 15 * 60 + 10) {
      errors.push(`${item.title} starts before school ends on a school day`);
    }
    if (item.kind === "break") {
      const before = items[i - 1];
      const after = items[i + 1];
      if (before?.kind !== "work" || after?.kind !== "work") {
        errors.push(`isolated break at ${item.startMin}`);
      }
      if (before && before.endMin !== item.startMin) errors.push("break not attached to prior work");
      if (after && after.startMin !== item.endMin) errors.push("break not attached to next work");
    }
  }
  const accounted =
    plan.summary.workMinutes +
    plan.summary.breakMinutes +
    plan.summary.personalMinutes +
    plan.summary.freeMinutes +
    plan.summary.eventMinutes;
  if (plan.summary.workMinutes !== plan.workMinutes) errors.push("work summary mismatch");
  if (plan.summary.freeMinutes !== plan.freeMinutes) errors.push("free summary mismatch");
  if (accounted > plan.summary.windowMinutes + 1) errors.push("summary exceeds window");
  return errors;
}

export function getCoachDayPlan(state: AppState, day: Date, now = new Date()): CoachDayPlan {
  const date = startOfDay(day);
  const dateKey = toISODate(date);
  const smart = buildSmartSchedule(state, now);
  const window = dayWorkWindow(state, date);
  const schoolDay = isAcademicSchoolDay(state, date);

  const workItems: CoachItem[] = smart.plans.flatMap((plan) =>
    plan.sessions
      .filter((session) => session.dateKey === dateKey && session.startMin != null && session.endMin != null)
      .map((session) => ({
        kind: "work" as const,
        startMin: session.startMin!,
        endMin: session.endMin!,
        minutes: session.minutes,
        title: session.title,
        emoji: taskEmoji(plan.task),
        taskId: plan.task.id,
      })),
  );
  const breakItems: CoachItem[] = smart.breaks
    .filter((item) => item.dateKey === dateKey)
    .map((item) => ({
      kind: "break" as const,
      startMin: item.startMin,
      endMin: item.endMin,
      minutes: item.minutes,
      title: item.label,
      emoji: "☕",
    }));

  const eventSpans: OpenSpan[] = [];
  for (const event of state.events) {
    for (const occ of occupanciesForEvent(event, date)) {
      eventSpans.push({ startMin: occ.startMin, endMin: occ.endMin });
    }
  }

  const occupied: OpenSpan[] = [
    ...workItems,
    ...breakItems,
    ...eventSpans,
  ].map((item) => ({ startMin: item.startMin, endMin: item.endMin }));

  const clockStart =
    toISODate(date) === toISODate(now)
      ? Math.max(window.start, now.getHours() * 60 + now.getMinutes())
      : window.start;
  let remainder: OpenSpan[] = [{ startMin: clockStart, endMin: window.end }];
  for (const item of occupied) {
    remainder = subtractBooked(remainder, item);
  }

  const personalItems: CoachItem[] = [];
  const leftover: OpenSpan[] = [];
  for (const span of remainder) {
    const dinner = clipSpan(span, PERSONAL_START, PERSONAL_END);
    if (dinner) {
      personalItems.push({
        kind: "personal",
        startMin: dinner.startMin,
        endMin: dinner.endMin,
        minutes: dinner.endMin - dinner.startMin,
        title: "Dinner / personal time",
        emoji: "🍽️",
      });
      leftover.push(...subtractBooked([span], dinner));
    } else {
      leftover.push(span);
    }
  }

  const freeItems: CoachItem[] = mergeSpans(leftover)
    .filter((span) => span.endMin - span.startMin >= 15)
    .map((span) => {
      const meta = freeLabel(span.startMin);
      return {
        kind: "free" as const,
        startMin: span.startMin,
        endMin: span.endMin,
        minutes: span.endMin - span.startMin,
        title: meta.title,
        emoji: meta.emoji,
        period: meta.title,
      };
    });

  const items = [...workItems, ...breakItems, ...personalItems, ...freeItems].sort(
    (a, b) => a.startMin - b.startMin,
  );
  const eventMinutes = eventSpans.reduce((sum, span) => {
    const clipped = clipSpan(span, window.start, window.end);
    return sum + (clipped ? clipped.endMin - clipped.startMin : 0);
  }, 0);
  const summary = {
    ...calculateDailySummary(items, window),
    eventMinutes,
  };
  const leftoverFree =
    [...freeItems].reverse().find((item) => item.startMin >= 17 * 60) ??
    freeItems[freeItems.length - 1] ??
    null;
  const firstWork = [...workItems].sort((a, b) => a.startMin - b.startMin)[0];
  const lastWork = [...workItems].sort((a, b) => a.startMin - b.startMin)[workItems.length - 1];
  const headline = firstWork
    ? schoolDay
      ? `Tonight ${clockRange(firstWork.startMin, leftoverFree?.endMin ?? lastWork.endMin)} — here’s what I’d do`
      : `${clockRange(firstWork.startMin, lastWork.endMin)} is the best window for today’s work`
    : leftoverFree
      ? `${leftoverFree.emoji} ${clockRange(leftoverFree.startMin, leftoverFree.endMin)} is free`
      : "No open work time left today";

  return {
    date,
    dateKey,
    workMinutes: summary.workMinutes,
    breakMinutes: summary.breakMinutes,
    freeMinutes: summary.freeMinutes,
    personalMinutes: summary.personalMinutes,
    eventMinutes: summary.eventMinutes,
    windowMinutes: summary.windowMinutes,
    urgentCount: smart.plans.filter(
      (plan) => plan.track === "overdue" || plan.track === "at_risk" || daysUntilDue(plan.task, now) <= 1,
    ).length,
    testCount: smart.plans.filter((plan) => isStudyTask(plan.task)).length,
    items,
    headline,
    leftover: leftoverFree,
    summary,
  };
}

export function getTodayActionPlan(state: AppState, now = new Date()): FreeBlockPlan | null {
  const coach = getCoachDayPlan(state, startOfDay(now), now);
  const evening =
    coach.items.find((item) => item.kind === "work" && item.startMin >= 17 * 60) ??
    coach.items.find((item) => item.kind === "free" && item.startMin >= 17 * 60) ??
    coach.items.find((item) => item.kind === "free") ??
    null;
  if (!evening) return null;
  const uses = coach.items
    .filter((item) => item.kind === "work")
    .map((item) => ({
      taskId: item.taskId ?? "work",
      title: item.title,
      minutes: item.minutes,
      startMin: item.startMin,
      endMin: item.endMin,
      emoji: item.emoji,
    }));
  const slot: FreeSlot = {
    date: coach.date,
    dateKey: coach.dateKey,
    startMin: evening.startMin,
    endMin: Math.max(evening.endMin, uses[uses.length - 1]?.endMin ?? evening.endMin),
    minutes: Math.max(30, (uses[uses.length - 1]?.endMin ?? evening.endMin) - evening.startMin),
    size: "long",
  };
  return {
    slot,
    headline:
      evening.startMin >= 17 * 60
        ? `Tonight ${clockRange(evening.startMin, coach.leftover?.endMin ?? Math.max(evening.endMin, 21 * 60))} is available`
        : describeWhen(slot, now),
    sizeLabel: `${formatDuration(coach.workMinutes)} planned work · ${formatDuration(coach.freeMinutes)} free`,
    uses,
    leftoverMinutes: coach.leftover?.minutes ?? coach.freeMinutes,
  };
}

export function generateDeadlineReminders(
  state: AppState,
  now = new Date(),
): PlanningNotification[] {
  const dateKey = toISODate(now);
  const notes: PlanningNotification[] = [];
  const tonight = calculateFreeTime(state, startOfDay(now), { now }).sort((a, b) => b.minutes - a.minutes)[0];

  for (const task of state.tasks) {
    if (task.completed || workLeft(task) <= 0 || !task.dueAt) continue;
    const hours = hoursUntil(task.dueAt, now);
    const dueDay = startOfDay(new Date(task.dueAt));
    const daysLeft = Math.round((dueDay.getTime() - startOfDay(now).getTime()) / 86_400_000);
    const needed = neededMinutes(task);
    const plan = createTaskPlan(task, state, now);
    const nextSlot = plan.sessions[0];
    const when = nextSlot
      ? `${nextSlot.date.toLocaleDateString([], { weekday: "long" })} ${
          nextSlot.startMin != null && nextSlot.endMin != null
            ? clockRange(nextSlot.startMin, nextSlot.endMin)
            : nextSlot.label
        }`
      : tonight
        ? describeWhen(tonight, now)
        : "the next open evening";
    const id = `${task.id}:deadline:${dateKey}`;
    const isTest = task.type === "test" || task.type === "quiz";

    if (hours < 0) {
      notes.push({
        id: `${task.id}:overdue:${dateKey}`,
        kind: "overdue",
        urgency: "urgent",
        title: `🚨 ${task.title} is overdue`,
        message: `You still have ${formatDuration(needed)} left. ${when} is the next time to finish it.`,
      });
      continue;
    }

    if (plan.atRisk) {
      notes.push({
        id: `${task.id}:atrisk:${dateKey}`,
        kind: isTest ? "test" : "deadline",
        urgency: "urgent",
        title: `🚨 At risk · ${task.title}`,
        message: `${task.title} is due ${new Date(task.dueAt).toLocaleString([], {
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
        })}. You still need ${formatDuration(plan.remaining || plan.needed)} and only have ${formatDuration(plan.availableBeforeDeadline)} available before the deadline. You are short by ${formatDuration(plan.shortBy)}.`,
      });
      continue;
    }

    if (daysLeft <= 1) {
      notes.push({
        id,
        kind: isTest ? "test" : "deadline",
        urgency: "urgent",
        title:
          daysLeft <= 0
            ? `🚨 ${task.title} is due today`
            : `🚨 ${task.title} is due tomorrow`,
        message: `You still have ${formatDuration(needed)} left to finish it. ${when}.`,
      });
      continue;
    }

    if (daysLeft <= 3) {
      const enough = plan.enough;
      notes.push({
        id,
        kind: isTest ? "test" : "deadline",
        urgency: enough ? "important" : "urgent",
        title: isTest
          ? `🧠 ${task.title} in ${daysLeft} days`
          : `⏰ ${task.title} is due in ${daysLeft} days`,
        message: enough
          ? `You still need about ${formatDuration(needed)}. I found time at ${when}.`
          : `You still need about ${formatDuration(needed)} and there isn’t enough free time before it’s due. Use ${when}.`,
      });
      continue;
    }

    if (daysLeft <= 7) {
      notes.push({
        id,
        kind: isTest ? "test" : "deadline",
        urgency: needed >= 120 ? "important" : "upcoming",
        title: `📚 ${task.title} is due ${new Date(task.dueAt).toLocaleDateString([], { weekday: "long" })}`,
        message:
          daysLeft >= 4 && needed >= 90
            ? `You have ${daysLeft} days. Start now — I found ${when} so this does not pile up at the end.`
            : `You have plenty of time. I found ${when} to get started.`,
      });
    }
  }
  return notes;
}

export function generateFreeTimeNotifications(
  state: AppState,
  now = new Date(),
): PlanningNotification[] {
  const dateKey = toISODate(now);
  const action = getTodayActionPlan(state, now);
  if (!action || action.slot.minutes < 30) return [];
  const lines = action.uses
    .map((use) => `${use.emoji} ${use.title} — ${formatDuration(use.minutes)}`)
    .join(" ");
  const leftover =
    action.leftoverMinutes >= 15
      ? ` You still have ${formatDuration(action.leftoverMinutes)} free.`
      : " You’re done for tonight. 👍";
  return [
    {
      id: `freetime:${dateKey}:${action.slot.startMin}`,
      kind: "freetime",
      urgency: action.slot.size === "long" ? "opportunity" : "upcoming",
      title: `🟢 ${action.headline}`,
      message: lines
        ? `Use it like this: ${lines}.${leftover}`
        : `${action.sizeLabel}. No open work to fill it — you’re ahead.`,
    },
  ];
}

export function generatePlanningNotifications(
  state: AppState,
  now = new Date(),
): PlanningNotification[] {
  const dateKey = toISODate(now);
  const notes: PlanningNotification[] = [];
  const seen = new Set<string>();
  const push = (note: PlanningNotification) => {
    if (seen.has(note.id) || state.dismissedNotificationIds.includes(note.id)) return;
    seen.add(note.id);
    notes.push(note);
  };

  for (const conflict of detectScheduleConflicts(state, now).slice(0, 3)) {
    push({
      id: `conflict:${conflict.dateKey}:${[conflict.left.id, conflict.right.id].sort().join(":")}`,
      kind: "conflict",
      urgency: "urgent",
      title: "Schedule conflict detected",
      message: `${conflict.left.title} overlaps ${conflict.right.title} by ${formatDuration(conflict.overlapMinutes)} on ${conflict.date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}.`,
    });
  }

  for (const note of generateDeadlineReminders(state, now)) push(note);
  for (const note of generateFreeTimeNotifications(state, now)) push(note);

  const open = openTasks(state, now);
  const behind = open.filter((task) => getPlanningStatus(task, state, now) === "behind");
  const hasPressure = notes.some(
    (note) => note.urgency === "urgent" || note.urgency === "important",
  );
  if (
    open.length > 0 &&
    behind.length === 0 &&
    !hasPressure &&
    detectScheduleConflicts(state, now).length === 0
  ) {
    push({
      id: `ahead:all:${dateKey}`,
      kind: "ahead",
      urgency: "ok",
      title: "🚀 You’re ahead",
      message: "All upcoming assignments have enough time scheduled before they are due.",
    });
  }

  const rank: ReminderUrgency[] = ["urgent", "important", "upcoming", "opportunity", "ok"];
  return notes
    .sort((a, b) => rank.indexOf(a.urgency) - rank.indexOf(b.urgency))
    .slice(0, 7);
}

export function todayInsights(state: AppState, now = new Date()) {
  const today = startOfDay(now);
  const key = toISODate(today);
  const conflicts = detectScheduleConflicts(state, now).filter((item) => item.dateKey === key);
  const dueToday = state.tasks.filter(
    (task) => !task.completed && workLeft(task) > 0 && task.dueAt && toISODate(new Date(task.dueAt)) === key,
  );
  const comingUp = [...state.tasks]
    .filter((task) => {
      if (task.completed || workLeft(task) <= 0 || !task.dueAt) return false;
      const due = startOfDay(new Date(task.dueAt));
      return due > today && due <= addDays(today, 7);
    })
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 4);
  const recommended = state.blocks
    .filter((block) => toISODate(new Date(block.start)) === key && block.status === "planned")
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const study = recommended.filter((block) => {
    const task = state.tasks.find((item) => item.id === block.taskId);
    return task?.type === "test" || task?.type === "quiz";
  });
  const free = getCoachDayPlan(state, today, now).items.filter((item) => item.kind === "free");
  const action = getTodayActionPlan(state, now);
  const notes = generatePlanningNotifications(state, now);
  const getAhead = notes.find((note) => note.kind === "freetime" || note.kind === "getahead");
  return { conflicts, dueToday, comingUp, recommended, study, free, getAhead, action };
}
