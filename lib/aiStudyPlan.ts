import { dueIsSoon, isExamType, type FreeWindow } from "./freeWindows";
import { formatClock, minutesOf, snapStudyClockMins, toTimeInput } from "./format";
import { addDays, startOfDay, toISODate, uid } from "./time";
import type { AiPlanSession, AiStudyPlan, StudySession, Task } from "./types";

export type PlanTaskInput = {
  title: string;
  subject: string;
  type: string;
  dueDate: string;
  dueAt: string;
  hoursNeeded: number;
  difficulty?: string;
  priority?: string;
  canSplit?: boolean;
};

export function parseClockToMin(text: string): number {
  const raw = text.trim();
  if (/^\d{1,2}:\d{2}$/.test(raw)) return minutesOf(raw);
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 18 * 60;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const mer = match[3].toUpperCase();
  if (mer === "PM" && hours !== 12) hours += 12;
  if (mer === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function buildPlanningPrompt(task: PlanTaskInput, freeWindows: FreeWindow[]): string {
  const exam = isExamType(task.type);
  const soon = dueIsSoon(task.dueAt);
  const hours = Math.max(10 / 60, task.hoursNeeded || (exam ? 2 : 1));
  const totalMinutes = Math.round(hours * 60);
  const hoursLabel = totalMinutes < 60 ? `${totalMinutes} minutes` : `${hours} hours`;
  const windows = freeWindows
    .map(
      (window) =>
        `  ${window.day} ${window.date}: ${window.start} – ${window.end} (${window.hoursAvailable}h free)`,
    )
    .join("\n");
  const difficulty = task.difficulty || "medium";
  const priority = task.priority || "medium";
  const split = task.canSplit !== false;

  return `You are a study planner for a high school student.
Create a calm, specific, realistic study plan.
Never overwhelm the student.

TASK:
  Name: ${task.title}
  Subject: ${task.subject}
  Type: ${task.type}
  Due: ${task.dueDate}
  Hours needed: ${hoursLabel} (${hours} hours)
  Difficulty: ${difficulty}
  Priority: ${priority}
  Can split across sittings: ${split ? "yes" : "no"}

  Difficulty rules:
    These change HOW to study, not HOW LONG.
    easy → lighter focus; keep total equal to hours needed.
    medium → specific, practical focus; keep total equal to hours needed.
    hard → more review/practice in the focus line; keep total equal to hours needed.
    Never pad a short task (for example 30 minutes) up to 45–60 minutes.
  Priority rules:
    high → schedule earlier in the available windows.
    low → leave better evening slots for harder work if other tasks exist.

  ${
    exam
      ? `If this is a TEST or QUIZ:
    Honor the student's hours needed (${hoursLabel}) exactly. If they left the default, prefer 2 hours total.
    Split into sessions across different days when can-split is yes.
    Always include a short 20–30 minute "review and get ready" session on the evening before the quiz/test if that day is free and not already used.
    Do not skip the day before just because earlier study days exist.
    Include testDayTip: one subject-specific tip for test day.`
      : ""
  }
  ${soon ? "This is due very soon. Put one session in the longest evening window (prefer 7:00 PM–10:00 PM). Do not use a leftover 15-minute slot if a longer evening gap exists." : ""}

FREE TIME AVAILABLE BEFORE DUE DATE:
${windows}

RULES FOR THE PLAN:
  Combined session length MUST equal ${hoursLabel} exactly.
  Each study session = 15 to 90 minutes. Never more than 90 min in one sitting.
  If hours needed is 45 minutes or less, make exactly one session of that length.
  ${split && totalMinutes > 45 ? "Space sessions across different days when possible." : "Do not split — one sitting only, within the hours needed (cap 90 minutes)."}
  Prefer 7:00 PM–10:00 PM when that time is free. Do not schedule at 9:45 PM if 7:00 PM is open.
  Leave at least one free evening before due date when other days exist.
  If not enough free time, warn the student clearly.
  Keep focus instructions specific and actionable.
  Copy dateKey from the matching free window into each session.

RESPOND IN THIS EXACT JSON FORMAT — nothing else:
{
  "plan": [
    {
      "day": "Monday",
      "date": "Sep 15",
      "dateKey": "2026-09-15",
      "startTime": "6:30 PM",
      "endTime": "${totalMinutes <= 30 ? "7:00 PM" : "7:30 PM"}",
      "duration": "${hoursLabel}",
      "focus": "Read chapters 5-6 and outline main points",
      "tip": "Start with the section you find hardest"
    }
  ],
  "totalPrepTime": "${hoursLabel}",
  "readyBy": "Wednesday Sep 17",
  "warningMessage": null,
  "encouragement": "You have plenty of time — starting Monday keeps this completely stress-free.",
  "testDayTip": ${exam ? '"Write out all formulas on scratch paper before starting the test."' : "null"}
}

If there is not enough time set warningMessage
to a clear one-sentence explanation.
Keep encouragement honest and warm — never fake.`;
}

export function parseAiStudyPlan(raw: string): AiStudyPlan {
  const fenced = raw.match(/\{[\s\S]*\}/);
  if (!fenced) {
    throw new Error("No JSON in model response");
  }
  const parsed = JSON.parse(fenced[0]) as AiStudyPlan;
  if (!Array.isArray(parsed.plan)) {
    throw new Error("Invalid plan shape");
  }
  return {
    plan: parsed.plan.map((session) => ({
      day: session.day || "",
      date: session.date || "",
      dateKey: session.dateKey,
      startTime: session.startTime || "",
      endTime: session.endTime || "",
      duration: session.duration || "",
      focus: session.focus || "",
      tip: session.tip || "",
    })),
    totalPrepTime: parsed.totalPrepTime || "",
    readyBy: parsed.readyBy || "",
    warningMessage: parsed.warningMessage ?? null,
    encouragement: parsed.encouragement || "",
    testDayTip: parsed.testDayTip ?? null,
  };
}

export function resolveSessionDateKey(
  session: AiPlanSession,
  windows: FreeWindow[],
  dueAt: string,
): string {
  if (session.dateKey) {
    if (windows.length === 0 || windows.some((window) => window.dateKey === session.dateKey)) {
      return session.dateKey;
    }
  }
  const byDay = windows.find(
    (window) =>
      window.day.toLowerCase() === session.day.toLowerCase() ||
      window.date.toLowerCase() === session.date.toLowerCase(),
  );
  if (byDay) return byDay.dateKey;
  return toISODate(addDays(startOfDay(new Date(dueAt)), -1));
}

export function stampPlanDates(
  plan: AiStudyPlan,
  windows: FreeWindow[],
  dueAt: string,
): AiStudyPlan {
  return {
    ...plan,
    plan: plan.plan.map((session) => ({
      ...session,
      dateKey: resolveSessionDateKey(session, windows, dueAt),
    })),
  };
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes === 90) return "1.5 hours";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`;
}

export function planFromStudySessions(
  task: Task,
  sessions: StudySession[],
): AiStudyPlan | null {
  const mine = sessions
    .filter((session) => session.taskId === task.id && !session.skipped)
    .sort(
      (a, b) => a.dateKey.localeCompare(b.dateKey) || a.startMin - b.startMin,
    );
  if (!mine.length) return task.aiPlan ?? null;
  return {
    plan: mine.map((session) => {
      const date = session.dateKey
        ? new Date(`${session.dateKey}T12:00:00`)
        : null;
      const dateLabel =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString([], { month: "short", day: "numeric" })
          : session.date;
      const dayLabel =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString([], { weekday: "long" })
          : session.day;
      return {
        day: dayLabel,
        date: dateLabel,
        dateKey: session.dateKey,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: durationLabel(Math.max(15, session.endMin - session.startMin)),
        focus: session.focus,
        tip: session.tip,
      };
    }),
    totalPrepTime: task.aiPlan?.totalPrepTime || "",
    readyBy: task.aiPlan?.readyBy || "",
    warningMessage: task.aiPlan?.warningMessage ?? null,
    encouragement: task.aiPlan?.encouragement || "",
    testDayTip: task.aiPlan?.testDayTip ?? null,
  };
}

export function studySessionsFromPlan(
  taskId: string,
  plan: AiStudyPlan,
  windows: FreeWindow[],
  dueAt: string,
): StudySession[] {
  return plan.plan.map((session) => {
    const dateKey = resolveSessionDateKey(session, windows, dueAt);
    const snapped = snapStudyClockMins(parseClockToMin(session.startTime), parseClockToMin(session.endTime));
    return {
      id: uid(),
      taskId,
      userId: "local",
      day: session.day,
      date: session.date,
      dateKey,
      startTime: formatClock(toTimeInput(snapped.startMin)),
      endTime: formatClock(toTimeInput(snapped.endMin)),
      startMin: snapped.startMin,
      endMin: snapped.endMin,
      focus: session.focus,
      tip: session.tip,
      completed: false,
      skipped: false,
    };
  });
}
