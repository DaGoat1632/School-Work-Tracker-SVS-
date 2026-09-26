import type {
  AppState,
  FixedEvent,
  Preferences,
  ScheduledBlock,
  Task,
  Warning,
} from "./types";
import { recommendWindow } from "./planning";
import {
  addDays,
  addMinutes,
  combineDateAndTime,
  hoursUntil,
  isWeekend,
  minutesFromMidnight,
  sameDay,
  startOfDay,
  toISODate,
  uid,
  weekday,
} from "./time";

type Interval = { start: number; end: number };

const MIN_BLOCK = 15;
const MIN_WORK = 30;
const PERSONAL_START = 17 * 60;
const PERSONAL_END = 18 * 60;
/** Cover through next month so sidebar month view can show scheduled work. */
export const HORIZON_DAYS = 62;

function difficultyWeight(difficulty: Task["difficulty"]): number {
  if (difficulty === "hard") return 1.4;
  if (difficulty === "medium") return 1.15;
  return 1;
}

function typeWeight(type: Task["type"]): number {
  if (type === "test" || type === "quiz") return 1.3;
  if (type === "project") return 1.1;
  return 1;
}

export function taskPriority(task: Task, now = new Date()): number {
  const hours = Math.max(hoursUntil(task.dueAt, now), 0.25);
  const remainingHours = task.remainingMinutes / 60;
  const slack = hours - remainingHours;
  const deadlineBoost = hours < 36 ? 2.2 : 1;
  const tightness = 1 / Math.max(slack, 0.15);
  return tightness * deadlineBoost * difficultyWeight(task.difficulty) * typeWeight(task.type);
}

function eventsForDay(events: FixedEvent[], day: Date): FixedEvent[] {
  const dateKey = toISODate(day);
  const dow = weekday(day);
  return events.filter((event) => {
    if (event.specificDate) return event.specificDate === dateKey;
    return event.daysOfWeek.includes(dow);
  });
}

function busyIntervals(events: FixedEvent[], day: Date): Interval[] {
  return eventsForDay(events, day)
    .map((event) => {
      const start =
        minutesFromMidnight(event.startTime) - event.travelMinutesBefore;
      const end = minutesFromMidnight(event.endTime) + event.travelMinutesAfter;
      return { start: Math.max(0, start), end: Math.min(24 * 60, end) };
    })
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [sorted[0]];
  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function subtractBusy(window: Interval, busy: Interval[]): Interval[] {
  let free: Interval[] = [{ ...window }];
  for (const block of mergeIntervals(busy)) {
    const next: Interval[] = [];
    for (const slot of free) {
      if (block.end <= slot.start || block.start >= slot.end) {
        next.push(slot);
        continue;
      }
      if (block.start > slot.start) {
        next.push({ start: slot.start, end: block.start });
      }
      if (block.end < slot.end) {
        next.push({ start: block.end, end: slot.end });
      }
    }
    free = next;
  }
  return free.filter((slot) => slot.end - slot.start >= MIN_BLOCK);
}

function emptyPlannerState(prefs: Preferences, events: FixedEvent[]): AppState {
  return {
    preferences: prefs,
    events,
    tasks: [],
    blocks: [],
    studySessions: [],
    warnings: [],
    lastPlannedAt: null,
    planReady: false,
    dismissedNotificationIds: [],
  };
}

function dailyCap(prefs: Preferences, day: Date): number {
  return isWeekend(day) ? prefs.maxWeekendMinutes : prefs.maxWeeknightMinutes;
}

function takeFromSlot(
  slots: Interval[],
  slotIndex: number,
  minutes: number,
  breakMinutes: number,
): void {
  const slot = slots[slotIndex];
  const consumed = minutes + breakMinutes;
  slot.start += consumed;
  if (slot.end - slot.start < MIN_BLOCK) {
    slots.splice(slotIndex, 1);
  }
}

export function buildSchedule(input: {
  tasks: Task[];
  events: FixedEvent[];
  preferences: Preferences;
  keptBlocks?: ScheduledBlock[];
  now?: Date;
}): { blocks: ScheduledBlock[]; warnings: Warning[] } {
  const now = input.now ?? new Date();
  const today = startOfDay(now);
  const prefs = input.preferences;
  const kept = (input.keptBlocks ?? []).filter(
    (block) => block.status === "done" || block.status === "partial",
  );
  const plannerState = emptyPlannerState(prefs, input.events);

  const openTasks = input.tasks
    .filter((task) => !task.completed && task.remainingMinutes > 0)
    .sort((a, b) => {
      const byPriority = taskPriority(b, now) - taskPriority(a, now);
      if (Math.abs(byPriority) > 0.01) return byPriority;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });

  const remainingByTask = new Map(
    openTasks.map((task) => [task.id, task.remainingMinutes]),
  );
  const usedByDay = new Map<string, number>();
  const slotsByDay = new Map<string, Interval[]>();
  const generated: ScheduledBlock[] = [];

  for (let i = 0; i < HORIZON_DAYS; i += 1) {
    const day = addDays(today, i);
    const key = toISODate(day);
    const rec = recommendWindow(plannerState, day);
    const busy = busyIntervals(input.events, day);
    busy.push({ start: PERSONAL_START, end: PERSONAL_END });
    for (const block of kept) {
      const start = new Date(block.start);
      if (sameDay(start, day)) {
        busy.push({
          start: start.getHours() * 60 + start.getMinutes(),
          end:
            new Date(block.end).getHours() * 60 +
            new Date(block.end).getMinutes(),
        });
        usedByDay.set(key, (usedByDay.get(key) ?? 0) + block.minutes);
      }
    }
    if (i === 0) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      busy.push({ start: 0, end: nowMinutes });
    }
    slotsByDay.set(key, subtractBusy({ start: rec.start, end: rec.end }, busy));
    if (!usedByDay.has(key)) usedByDay.set(key, 0);
  }

  function minutesOnDay(taskId: string, key: string): number {
    return generated
      .filter((block) => block.taskId === taskId && toISODate(new Date(block.start)) === key)
      .reduce((sum, block) => sum + block.minutes, 0);
  }

  function placeChunk(task: Task, day: Date, minutes: number, taskDayCap: number): boolean {
    const key = toISODate(day);
    const rec = recommendWindow(plannerState, day);
    const due = new Date(task.dueAt);
    const dueEnd = sameDay(due, day) ? due.getHours() * 60 + due.getMinutes() : 24 * 60;
    if (dueEnd <= rec.start) return false;
    const slots = slotsByDay.get(key);
    if (!slots || slots.length === 0) return false;
    const used = usedByDay.get(key) ?? 0;
    const leftoverCap = Math.min(dailyCap(prefs, day) - used, taskDayCap - minutesOnDay(task.id, key));
    if (leftoverCap < MIN_BLOCK) return false;

    const take = Math.min(minutes, leftoverCap);
    if (take < MIN_WORK && minutes > take) return false;

    for (const slotIndex of slots.keys()) {
      const slot = slots[slotIndex];
      const available = slot.end - slot.start;
      const chunk = Math.min(take, available);
      if (!task.canSplit && chunk < minutes) continue;
      if (chunk < MIN_WORK && minutes > chunk) continue;
      if (chunk <= 0) continue;

      const start = addMinutes(combineDateAndTime(day, "00:00"), slot.start);
      if (start.getTime() + chunk * 60_000 > due.getTime()) {
        continue;
      }

      generated.push({
        id: uid(),
        taskId: task.id,
        title: task.title,
        start: start.toISOString(),
        end: addMinutes(start, chunk).toISOString(),
        minutes: chunk,
        status: "planned",
      });
      usedByDay.set(key, used + chunk);
      remainingByTask.set(task.id, (remainingByTask.get(task.id) ?? 0) - chunk);
      takeFromSlot(slots, slotIndex, chunk, prefs.breakMinutes);
      return true;
    }

    return false;
  }

  for (const task of openTasks) {
    const dueDay = startOfDay(new Date(task.dueAt));
    const lastDayIndex = Math.max(
      0,
      Math.min(
        HORIZON_DAYS - 1,
        Math.round((dueDay.getTime() - today.getTime()) / 86_400_000),
      ),
    );
    const large =
      task.type === "project" ||
      task.type === "test" ||
      task.type === "quiz" ||
      task.remainingMinutes >= 90;
    const taskDayCap = large ? 120 : dailyCap(prefs, addDays(today, 0));
    const sessionLen = task.type === "test" || task.type === "quiz" ? 45 : 60;
    const spreadEnd =
      large && lastDayIndex >= 2 ? Math.max(0, lastDayIndex - 1) : lastDayIndex;

    const wantChunk = (left: number) => {
      if (!task.canSplit) return left;
      if (left <= sessionLen) return left;
      return sessionLen;
    };

    const runPass = (endIndex: number, allowSecond: boolean) => {
      let any = false;
      for (let i = 0; i <= endIndex; i += 1) {
        const left = remainingByTask.get(task.id) ?? 0;
        if (left <= 0) break;
        const day = addDays(today, i);
        const key = toISODate(day);
        const already = minutesOnDay(task.id, key);
        if (!allowSecond && already > 0) continue;
        if (already >= taskDayCap) continue;
        if (placeChunk(task, day, wantChunk(left), taskDayCap)) any = true;
      }
      return any;
    };

    let guard = 0;
    while ((remainingByTask.get(task.id) ?? 0) > 0 && guard < 80) {
      guard += 1;
      if (runPass(spreadEnd, false)) continue;
      if (runPass(spreadEnd, true)) continue;
      if (spreadEnd < lastDayIndex && runPass(lastDayIndex, false)) continue;
      if (spreadEnd < lastDayIndex && runPass(lastDayIndex, true)) continue;
      break;
    }
  }

  const warnings: Warning[] = [];
  for (const task of openTasks) {
    const leftover = remainingByTask.get(task.id) ?? 0;
    if (new Date(task.dueAt).getTime() < now.getTime() && leftover > 0) {
      warnings.push({
        type: "past_due",
        taskId: task.id,
        message: `${task.title} is past due with ${leftover} minutes still open.`,
      });
    } else if (leftover > 0) {
      warnings.push({
        type: "overload",
        taskId: task.id,
        message: `${task.title} does not fit before ${new Date(task.dueAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. ${leftover} minutes are unscheduled.`,
      });
    } else {
      const hours = hoursUntil(task.dueAt, now);
      const load = task.remainingMinutes / Math.max(hours, 1);
      if (load > 25) {
        warnings.push({
          type: "tight",
          taskId: task.id,
          message: `${task.title} fits, but the window is tight. A missed session will overflow.`,
        });
      }
    }
    if (task.type === "test" || task.type === "quiz") {
      const recommended =
        task.estimatedMinutes > 0 ? task.estimatedMinutes : 120;
      const planned = Math.max(0, recommended - leftover);
      if (leftover > 0 || planned < recommended) {
        warnings.push({
          type: "study_short",
          taskId: task.id,
          message: `⚠️ You may not have enough study time before this test. Study planned: ${Math.round(planned / 60 * 10) / 10} hr. Recommended: ${Math.round(recommended / 60 * 10) / 10} hr. Remaining: ${leftover} min.`,
        });
      }
    }
  }

  const blocks = [...kept, ...generated].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return { blocks, warnings };
}
