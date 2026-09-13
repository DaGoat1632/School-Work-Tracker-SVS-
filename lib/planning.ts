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
  kind: "work" | "break" | "free";
  startMin: number;
  endMin: number;
  minutes: number;
  title: string;
  emoji: string;
  taskId?: string;
  period?: string;
};

export type CoachDayPlan = {
  date: Date;
  dateKey: string;
  workMinutes: number;
  breakMinutes: number;
  freeMinutes: number;
  urgentCount: number;
  testCount: number;
  items: CoachItem[];
  headline: string;
  leftover: CoachItem | null;
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
  if (event.specificDate) return event.specificDate === toISODate(day);
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
  blocks: ScheduledBlock[] = [],
  now = new Date(),
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
      ...occupanciesForBlocks(blocks, day),
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

export function detectAllTimeConflicts(state: AppState, now = new Date()): TimeConflict[] {
  const conflicts: TimeConflict[] = [];
  const seen = new Set<string>();
  for (const event of state.events) {
    for (const hit of detectTimeConflicts(event, state.events, state.blocks, now)) {
      const key = `${hit.dateKey}:${[hit.left.id, hit.right.id].sort().join(":")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push(hit);
    }
  }
  return conflicts;
}

export function formatConflictMessage(conflict: TimeConflict): string {
  return `⚠️ Time conflict\n${conflict.left.title}: ${clockRange(conflict.left.startMin, conflict.left.endMin)}\n${conflict.right.title}: ${clockRange(conflict.right.startMin, conflict.right.endMin)}\nYou have a ${formatDuration(conflict.overlapMinutes)} overlap.`;
}

function workWindow(state: AppState): { start: number; end: number } {
  const start = minutesFromMidnight(state.preferences.wakeTime);
  const sleep = minutesFromMidnight(state.preferences.sleepTime);
  const cutoff = minutesFromMidnight(state.preferences.noWorkAfter);
  const end = Math.min(sleep > start ? sleep : 24 * 60, cutoff > start ? cutoff : 24 * 60);
  return { start, end: Math.max(start + 15, end) };
}

function schoolDayEnd(state: AppState, day: Date): number | null {
  const ends = state.events
    .filter((event) => event.category === "school" && eventMatchesDay(event, day))
    .flatMap((event) => occupanciesForEvent(event, day))
    .map((item) => item.endMin);
  return ends.length ? Math.max(...ends) : null;
}

/** Hours we are willing to recommend work — not the same as "awake and uncommitted." */
export function recommendWindow(
  state: AppState,
  day: Date,
): { start: number; end: number } {
  const wake = minutesFromMidnight(state.preferences.wakeTime);
  const latest = workWindow(state).end;
  const end = Math.min(latest, 21 * 60);
  const schoolEnd = schoolDayEnd(state, day);
  let start = wake;
  if (schoolEnd != null) start = Math.max(wake, schoolEnd, 15 * 60 + 30);
  else if (isWeekend(day)) start = Math.max(wake, 8 * 60);
  else start = Math.max(wake, 15 * 60 + 30);
  return { start, end: Math.max(start + 20, end) };
}

export function calculateFreeTime(
  state: AppState,
  day: Date,
  options?: { includeWorkBlocks?: boolean; now?: Date },
): FreeSlot[] {
  const includeWork = options?.includeWorkBlocks ?? true;
  const clock = options?.now ?? new Date();
  const window = workWindow(state);
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

const MIN_WORK = 20;

function daysUntilDue(task: Task, now: Date): number {
  return Math.round(
    (startOfDay(new Date(task.dueAt)).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
}

function isStudyTask(task: Task): boolean {
  return task.type === "test" || task.type === "quiz";
}

function dailyShare(task: Task, now: Date, needed: number): number {
  const days = Math.max(1, daysUntilDue(task, now) + 1);
  const dueSoon = daysUntilDue(task, now) <= 1;
  if (dueSoon && !isStudyTask(task)) return needed;
  if (isStudyTask(task)) {
    const pieces = Math.min(Math.max(days - (dueSoon ? 0 : 1), 1), 4);
    return Math.max(MIN_WORK, Math.min(45, Math.ceil(needed / pieces)));
  }
  if (task.type === "project" || needed >= 90) {
    const pieces = Math.min(days, 5);
    return Math.max(30, Math.min(50, Math.ceil(needed / pieces)));
  }
  if (needed <= 60) return needed;
  return Math.max(MIN_WORK, Math.min(50, Math.ceil(needed / Math.min(days, 3))));
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
): OpenSpan | null {
  const startBound = Math.max(span.startMin, minStart);
  const endBound = Math.min(span.endMin, maxEnd);
  const room = endBound - startBound;
  if (room < MIN_WORK && room < takeMax) return null;
  const take = Math.min(takeMax, room);
  if (take < MIN_WORK && take < takeMax) return null;
  if (take < 15) return null;
  const preferred = [18 * 60, 15 * 60 + 30, 12 * 60, startBound];
  for (const candidate of preferred) {
    const start = Math.max(startBound, candidate);
    if (start + take <= endBound) return { startMin: start, endMin: start + take };
  }
  if (startBound + take <= endBound) {
    return { startMin: startBound, endMin: startBound + take };
  }
  return null;
}

function spanScore(startMin: number): number {
  if (startMin >= 18 * 60 && startMin < 21 * 60) return 80;
  if (startMin >= 15 * 60 + 30) return 60;
  if (startMin >= 12 * 60) return 25;
  if (startMin >= 8 * 60) return 8;
  return -30;
}

function takeFromDay(
  spans: OpenSpan[],
  takeMax: number,
  minStart: number,
  maxEnd: number,
): { booked: OpenSpan; next: OpenSpan[] } | null {
  let best: { booked: OpenSpan; score: number } | null = null;
  for (const span of spans) {
    const booked = placementInSpan(span, takeMax, minStart, maxEnd);
    if (!booked) continue;
    const score = spanScore(booked.startMin) + Math.min(20, (span.endMin - span.startMin) / 15);
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
    const task = tasks.find((item) => item.id === session.taskId);
    if (!task || task.completed || workLeft(task) <= 0) continue;
    const cutoff = dueCutoffMin(task, session.date);
    if (session.endMin > cutoff) continue;
    const dueTime = new Date(task.dueAt).getTime();
    const startDate = new Date(session.date);
    startDate.setHours(0, 0, 0, 0);
    startDate.setMinutes(session.startMin);
    if (startDate.getTime() >= dueTime) continue;

    const busy = [
      ...state.events.flatMap((event) => occupanciesForEvent(event, session.date)),
      ...occupanciesForBlocks(state.blocks, session.date),
    ];
    const booked: Occupancy = {
      id: `rec-${session.taskId}-${session.startMin}`,
      title: session.title,
      startMin: session.startMin,
      endMin: session.endMin,
      kind: "work",
    };
    if (busy.some((item) => overlapMinutes(item, booked) > 0)) continue;

    const original = calculateFreeTime(state, session.date, { now });
    const insideFree = original.some(
      (slot) => session.startMin! >= slot.startMin && session.endMin! <= slot.endMin,
    );
    if (!insideFree) continue;
    if (valid.some((other) => sessionOverlaps(other, session))) continue;
    valid.push(session);
  }
  return valid;
}

export function buildSmartSchedule(state: AppState, now = new Date()): SmartSchedule {
  const today = startOfDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const prefBreak = Math.max(0, state.preferences.breakMinutes || 10);
  const availability = new Map<string, OpenSpan[]>();
  const workToday = new Map<string, number>();
  const focusedToday = new Map<string, number>();
  const urgentSoon = state.tasks.some(
    (task) => !task.completed && neededMinutes(task) > 0 && daysUntilDue(task, now) <= 1,
  );

  for (let offset = 0; offset <= 14; offset += 1) {
    const day = addDays(today, offset);
    const window = recommendWindow(state, day);
    availability.set(
      toISODate(day),
      calculateFreeTime(state, day, { now })
        .map((slot) => ({ startMin: slot.startMin, endMin: slot.endMin }))
        .map((span) => clipSpan(span, window.start, window.end))
        .filter((span): span is OpenSpan => Boolean(span)),
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
  const breaks: BreakBlock[] = [];
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
      const relax =
        daysUntilDue(task, now) <= 1 && dueEnd <= window.start
          ? minutesFromMidnight(state.preferences.wakeTime)
          : window.start;
      const minStart = toISODate(day) === toISODate(today) ? Math.max(relax, nowMin) : relax;
      availableBeforeDeadline += spanMinutes(
        availability.get(toISODate(day)) ?? [],
        minStart,
        Math.min(window.end, dueEnd),
      );
    }

    let left = needed;
    const sessions: SessionSuggestion[] = [];

    const placeOnDay = (day: Date, relaxMorning: boolean) => {
      if (left < 15) return;
      const dateKey = toISODate(day);
      const window = recommendWindow(state, day);
      const dueEnd = dueCutoffMin(task, day);
      if (dueEnd <= window.start && !relaxMorning) return;
      const startFloor = relaxMorning
        ? minutesFromMidnight(state.preferences.wakeTime)
        : window.start;
      const minStart = dateKey === toISODate(today) ? Math.max(startFloor, nowMin) : startFloor;
      const maxEnd = Math.min(window.end, dueEnd);
      const limit = dayWorkLimit(state, day, urgentSoon || daysUntilDue(task, now) <= 1);
      let usedDay = workToday.get(dateKey) ?? 0;
      const alreadyForTask = sessions.filter((session) => session.dateKey === dateKey).length;
      const maxSessionsToday = study && daysUntilDue(task, now) <= 1 ? 2 : 1;
      if (alreadyForTask >= maxSessionsToday) return;
      if (usedDay >= limit) return;

      let takeMax = Math.min(
        left,
        share,
        study
          ? Math.min(blockPref, 45)
          : !study && (task.canSplit === false || needed <= 60)
            ? left
            : share,
        Math.max(0, limit - usedDay),
      );
      if (takeMax < MIN_WORK) {
        if (left >= 15 && left <= MIN_WORK) takeMax = left;
        else return;
      }

      const taken = takeFromDay(availability.get(dateKey) ?? [], takeMax, minStart, maxEnd);
      if (!taken) return;
      const minutes = taken.booked.endMin - taken.booked.startMin;
      if (minutes < 15) return;
      availability.set(dateKey, taken.next);
      left -= minutes;
      usedDay += minutes;
      workToday.set(dateKey, usedDay);
      focusedToday.set(dateKey, (focusedToday.get(dateKey) ?? 0) + minutes);
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

      const gap = breakAfter(minutes, focusedToday.get(dateKey) ?? 0, prefBreak);
      const breakBooked = {
        startMin: taken.booked.endMin,
        endMin: taken.booked.endMin + gap,
      };
      const remainingSpans = availability.get(dateKey) ?? [];
      const canBreak =
        gap >= 5 &&
        breakBooked.endMin <= maxEnd &&
        remainingSpans.some(
          (span) => span.startMin <= breakBooked.startMin && span.endMin >= breakBooked.endMin,
        );
      if (canBreak) {
        availability.set(dateKey, subtractBooked(remainingSpans, breakBooked));
        breaks.push({
          date: day,
          dateKey,
          startMin: breakBooked.startMin,
          endMin: breakBooked.endMin,
          minutes: gap,
          label:
            (focusedToday.get(dateKey) ?? 0) >= 90
              ? `☕ ${gap}-minute break · stretch / grab water`
              : `☕ ${gap}-minute break`,
        });
      }
    };

    for (let offset = 0; offset <= 14 && left >= 15; offset += 1) {
      const day = addDays(today, offset);
      if (day > lastDay) break;
      placeOnDay(day, false);
    }
    if (left >= 15 && daysUntilDue(task, now) <= 1) {
      for (let offset = 0; offset <= 14 && left >= 15; offset += 1) {
        const day = addDays(today, offset);
        if (day > lastDay) break;
        placeOnDay(day, true);
      }
    }

    const valid = validateRecommendedSessions(
      [...placed, ...sessions],
      state,
      state.tasks,
      now,
    ).filter((session) => session.taskId === task.id);
    placed.push(...valid);
    const planned = valid.reduce((sum, session) => sum + session.minutes, 0);
    const remaining = Math.max(0, needed - planned);
    let track: TrackState = "on_track";
    if (hours < 0) track = "overdue";
    else if (availableBeforeDeadline < needed) track = "at_risk";
    else if (planned < needed) track = "needs_planning";
    const atRisk = track === "at_risk" || track === "overdue";
    plans.push({
      task,
      needed,
      planned,
      remaining,
      enough: track === "on_track",
      status: atRisk ? "behind" : "on_track",
      track,
      sessions: valid,
      availableBeforeDeadline,
      shortBy: remaining,
      atRisk,
    });
  }

  const workSessions = plans.flatMap((plan) => plan.sessions);
  const usedBreaks = breaks.filter((item) =>
    workSessions.some(
      (session) =>
        session.dateKey === item.dateKey && session.startMin === item.endMin,
    ),
  );

  return { plans, breaks: usedBreaks };
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

function freePeriod(startMin: number): { label: string; emoji: string } {
  if (startMin >= 18 * 60 && startMin < 21 * 60) return { label: "Free evening", emoji: "🟢" };
  if (startMin >= 17 * 60 && startMin < 18 * 60) return { label: "Dinner / personal time", emoji: "🍽️" };
  if (startMin >= 15 * 60 + 30) return { label: "Free time", emoji: "🟢" };
  if (startMin >= 12 * 60) return { label: "Free afternoon", emoji: "🟢" };
  if (startMin >= 8 * 60) return { label: "Free morning", emoji: "🟢" };
  return { label: "Free time", emoji: "🟢" };
}

function splitFreePeriods(slots: OpenSpan[]): OpenSpan[] {
  const cuts = [12 * 60, 15 * 60 + 30, 17 * 60, 18 * 60, 21 * 60];
  const out: OpenSpan[] = [];
  for (const slot of slots) {
    let start = slot.startMin;
    const ends = [...cuts.filter((cut) => cut > slot.startMin && cut < slot.endMin), slot.endMin];
    for (const end of ends) {
      if (end - start >= 15) out.push({ startMin: start, endMin: end });
      start = end;
    }
  }
  return out;
}

export function getCoachDayPlan(state: AppState, day: Date, now = new Date()): CoachDayPlan {
  const date = startOfDay(day);
  const dateKey = toISODate(date);
  const smart = buildSmartSchedule(state, now);
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
  const occupied = [...workItems, ...breakItems];
  let freeSpans: OpenSpan[] = calculateFreeTime(state, date, { now }).map((slot) => ({
    startMin: slot.startMin,
    endMin: slot.endMin,
  }));
  for (const item of occupied) {
    freeSpans = subtractBooked(freeSpans, { startMin: item.startMin, endMin: item.endMin });
  }
  const freeItems: CoachItem[] = splitFreePeriods(freeSpans).map((span) => {
    const meta = freePeriod(span.startMin);
    return {
      kind: "free" as const,
      startMin: span.startMin,
      endMin: span.endMin,
      minutes: span.endMin - span.startMin,
      title: meta.label,
      emoji: meta.emoji,
      period: meta.label,
    };
  });
  const items = [...workItems, ...breakItems, ...freeItems].sort((a, b) => a.startMin - b.startMin);
  const workMinutes = workItems.reduce((sum, item) => sum + item.minutes, 0);
  const breakMinutes = breakItems.reduce((sum, item) => sum + item.minutes, 0);
  const freeMinutes = freeItems.reduce((sum, item) => sum + item.minutes, 0);
  const leftover = [...freeItems].reverse().find((item) => item.startMin >= 17 * 60) ?? freeItems[freeItems.length - 1] ?? null;
  const firstWork = workItems[0];
  const headline = firstWork
    ? `${clockRange(firstWork.startMin, workItems[workItems.length - 1].endMin)} is the best window to knock out today’s work`
    : leftover
      ? `${leftover.emoji} ${clockRange(leftover.startMin, leftover.endMin)} is free`
      : "No open work time left today";
  const urgentCount = smart.plans.filter(
    (plan) => plan.track === "overdue" || plan.track === "at_risk" || daysUntilDue(plan.task, now) <= 1,
  ).length;
  const testCount = smart.plans.filter((plan) => isStudyTask(plan.task)).length;
  return {
    date,
    dateKey,
    workMinutes,
    breakMinutes,
    freeMinutes,
    urgentCount,
    testCount,
    items,
    headline,
    leftover,
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
        })}. You need ${formatDuration(plan.needed)} but only have ${formatDuration(plan.availableBeforeDeadline)} available before the deadline. You are short by ${formatDuration(plan.shortBy)}.`,
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
          : `⚠️ You still need about ${formatDuration(needed)} and there isn’t enough free time before it’s due. Use ${when}.`,
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
      title: "⚠️ Schedule conflict detected",
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
