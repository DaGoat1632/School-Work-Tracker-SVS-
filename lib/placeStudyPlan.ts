import { parseClockToMin } from "./aiStudyPlan";
import { formatClock, snapToHalfHour, toTimeInput } from "./format";
import {
  dueIsSoon,
  getFreeWindows,
  isExamTask,
  nightBeforeKey,
  type FreeWindow,
} from "./freeWindows";
import { startOfDay, toISODate } from "./time";
import type { AiPlanSession, AiStudyPlan, FixedEvent, StudySession } from "./types";

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes === 90) return "1.5 hours";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`;
}

function sessionInWindow(
  window: FreeWindow,
  minutes: number,
  focus: string,
  tip: string,
): { session: AiPlanSession; minutes: number } {
  const take = Math.min(Math.max(minutes, 15), window.endMin - window.startMin, 90);
  const startMin = snapToHalfHour(window.startMin);
  const endMin = startMin + take;
  return {
    minutes: take,
    session: {
      day: window.day,
      date: window.date,
      dateKey: window.dateKey,
      startTime: formatClock(toTimeInput(startMin)),
      endTime: formatClock(toTimeInput(endMin)),
      duration: durationLabel(take),
      focus,
      tip,
    },
  };
}

export function hoursForTask(task: {
  type: string;
  estimatedMinutes?: number;
  remainingMinutes?: number;
  title?: string;
}): number {
  const minutes = task.remainingMinutes || task.estimatedMinutes;
  if (minutes && minutes > 0) return minutes / 60;
  return isExamTask(task) ? 2 : 1;
}

function parseDurationLabel(text?: string): number | null {
  if (!text) return null;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*hours?/i);
  if (hours) return Math.round(Number(hours[1]) * 60);
  const mins = text.match(/(\d+)\s*min/i);
  if (mins) return Number(mins[1]);
  return null;
}

function sessionLengthMin(session: AiPlanSession): number {
  const start = parseClockToMin(session.startTime);
  const end = parseClockToMin(session.endTime);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) return end - start;
  return parseDurationLabel(session.duration) ?? 30;
}

/** Keep planned work equal to the minutes the student said they need. */
export function fitPlanToNeededMinutes(plan: AiStudyPlan, needMin: number): AiStudyPlan {
  const target = Math.max(15, Math.round(needMin));
  if (!plan.plan?.length) {
    return { ...plan, totalPrepTime: durationLabel(target) };
  }

  let remaining = target;
  const fitted: AiPlanSession[] = [];
  for (const session of plan.plan) {
    if (remaining < 15) break;
    const start = snapToHalfHour(parseClockToMin(session.startTime));
    const current = sessionLengthMin(session);
    const take = Math.min(Math.max(current, 15), remaining, 90);
    fitted.push({
      ...session,
      startTime: formatClock(toTimeInput(start)),
      endTime: formatClock(toTimeInput(start + take)),
      duration: durationLabel(take),
    });
    remaining -= take;
  }

  return {
    ...plan,
    plan: fitted.length ? fitted : plan.plan,
    totalPrepTime: durationLabel(target),
  };
}

export function windowsForTask(input: {
  task: { type: string; dueAt: string; id: string; title?: string };
  events: FixedEvent[];
  studySessions?: Pick<StudySession, "dateKey" | "startMin" | "endMin" | "taskId">[];
  now?: Date;
}): FreeWindow[] {
  const now = input.now ?? new Date();
  const due = new Date(input.task.dueAt);
  const exam = isExamTask(input.task);
  const busy = (input.studySessions ?? []).filter((session) => session.taskId !== input.task.id);
  const exclude: string[] = [];
  if (exam) exclude.push(toISODate(due));

  const args = {
    events: input.events,
    fromDate: now,
    toDate: due,
    busySessions: busy,
    dueEndMin: due.getHours() * 60 + due.getMinutes(),
  };

  if (exam) {
    const nightBefore = nightBeforeKey(input.task.dueAt);
    const withoutNight = getFreeWindows({ ...args, excludeDateKeys: [...exclude, nightBefore] });
    if (withoutNight.length > 0) return withoutNight;
    return getFreeWindows({ ...args, excludeDateKeys: exclude });
  }

  return getFreeWindows({ ...args, excludeDateKeys: exclude });
}

function mathTip(subject: string): string {
  const text = subject.toLowerCase();
  if (text.includes("algebra") || text.includes("math") || text.includes("calc") || text.includes("geo")) {
    return "Write out all formulas on scratch paper before starting the test.";
  }
  if (text.includes("chem") || text.includes("bio") || text.includes("physics") || text.includes("sci")) {
    return "Do one mixed practice set without notes, then check what you missed.";
  }
  if (text.includes("hist") || text.includes("english") || text.includes("lit")) {
    return "Say the main argument out loud once before you sleep.";
  }
  return "Start with the section you find hardest.";
}

function daysBeforeDue(window: FreeWindow, dueAt: string): number {
  const due = startOfDay(new Date(dueAt)).getTime();
  const day = startOfDay(new Date(`${window.dateKey}T12:00:00`)).getTime();
  return Math.round((due - day) / 86_400_000);
}

export function buildLocalStudyPlan(
  task: { title: string; className?: string; type: string; dueAt: string; estimatedMinutes?: number },
  windows: FreeWindow[],
): AiStudyPlan {
  const exam = isExamTask(task);
  const soon = dueIsSoon(task.dueAt);
  const subject = task.className || task.title || "this subject";
  const needMin = Math.round(hoursForTask(task) * 60);
  const placed: { session: AiPlanSession; minutes: number }[] = [];
  const tip = exam ? mathTip(subject) : "Start with the section you find hardest.";

  if (windows.length === 0) {
    return {
      plan: [],
      totalPrepTime: durationLabel(needMin),
      readyBy: "",
      warningMessage: "No free time found before this deadline.",
      encouragement: "Move an activity or ask for more time so this work can fit.",
      testDayTip: exam ? tip : null,
    };
  }

  if (exam && !soon && windows.length >= 2 && needMin > 45) {
    const firstTake = Math.min(90, Math.max(30, Math.round(needMin / 2)));
    const secondTake = Math.max(15, needMin - firstTake);
    const first =
      windows.find((window) => {
        const days = daysBeforeDue(window, task.dueAt);
        return days >= 3 && days <= 4;
      }) ?? windows[0];
    const second =
      windows.find((window) => {
        if (window.dateKey === first.dateKey) return false;
        return daysBeforeDue(window, task.dueAt) === 2;
      }) ?? windows.find((window) => window.dateKey !== first.dateKey) ?? first;
    placed.push(
      sessionInWindow(first, firstTake, "Review all notes, identify weak areas", "Start with the section you find hardest."),
    );
    placed.push(sessionInWindow(second, secondTake, "Practice problems and self-quiz", tip));
  } else if (soon || windows.length === 1 || needMin <= 45) {
    const window = windows[0];
    const minutes = Math.min(90, Math.max(15, Math.min(needMin, window.endMin - window.startMin)));
    placed.push(
      sessionInWindow(
        window,
        minutes,
        exam ? "Review all notes and work a few practice problems" : `Focus on ${task.title}`,
        tip,
      ),
    );
  } else {
    const usable = windows.slice(0, -1);
    let remaining = needMin;
    for (const window of usable) {
      if (remaining < 15) break;
      const room = window.endMin - window.startMin;
      if (room < 15) continue;
      const take = Math.min(90, room, remaining);
      placed.push(sessionInWindow(window, take, `Work on ${task.title}`, tip));
      remaining -= take;
    }
    if (placed.length === 0) {
      placed.push(sessionInWindow(windows[0], Math.min(90, needMin), `Work on ${task.title}`, tip));
    }
  }

  const minutesPlaced = placed.reduce((sum, item) => sum + item.minutes, 0);
  const last = placed[placed.length - 1]?.session;
  const warning = soon
    ? `This is due very soon. Here is your only available study window: ${windows[0].day} ${windows[0].start} – ${windows[0].end}`
    : minutesPlaced + 10 < needMin
      ? "There is not enough open evening time to fit every hour before this is due."
      : null;

  return fitPlanToNeededMinutes(
    {
      plan: placed.map((item) => item.session),
      totalPrepTime: durationLabel(needMin),
      readyBy: last ? `${last.day} ${last.date}` : "",
      warningMessage: warning,
      encouragement: soon
        ? "This is tight, but one focused session still moves this forward."
        : `These sessions are only for ${task.title} — starting with the first one keeps it calm.`,
      testDayTip: exam ? tip : null,
    },
    needMin,
  );
}

export function ensurePlacedPlan(
  task: {
    title: string;
    className?: string;
    type: string;
    dueAt: string;
    estimatedMinutes?: number;
    remainingMinutes?: number;
  },
  plan: AiStudyPlan | undefined,
  windows: FreeWindow[],
): AiStudyPlan {
  const needMin = Math.round(hoursForTask(task) * 60);
  const local = fitPlanToNeededMinutes(buildLocalStudyPlan(task, windows), needMin);
  if (!plan?.plan?.length) return local;
  if (windows.length === 0) return fitPlanToNeededMinutes(plan, needMin);
  return fitPlanToNeededMinutes(
    {
      ...plan,
      plan: plan.plan.map((session, index) => ({
        ...session,
        dateKey: session.dateKey || local.plan[index]?.dateKey,
        focus: session.focus || local.plan[index]?.focus || `Work on ${task.title}`,
        tip: session.tip || local.plan[index]?.tip || "",
      })),
      totalPrepTime: plan.totalPrepTime || local.totalPrepTime,
      readyBy: plan.readyBy || local.readyBy,
      warningMessage: plan.warningMessage ?? local.warningMessage,
      encouragement: plan.encouragement || local.encouragement,
      testDayTip: plan.testDayTip ?? local.testDayTip,
    },
    needMin,
  );
}
