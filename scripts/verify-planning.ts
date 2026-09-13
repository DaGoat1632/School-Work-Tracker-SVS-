import {
  buildReservedSchedule,
  buildSmartSchedule,
  calculateFreeTime,
  createStudyPlan,
  createTaskPlan,
  generateDeadlineReminders,
  generatePlanningNotifications,
  getTodayActionPlan,
} from "../lib/planning";
import { addDays, combineDateAndTime, startOfDay, toISODate } from "../lib/time";
import { DEFAULT_PREFERENCES } from "../lib/types";
import type { AppState, Task } from "../lib/types";

const now = combineDateAndTime(startOfDay(new Date("2026-09-14T16:00:00")), "16:00");

function task(partial: Partial<Task> & Pick<Task, "id" | "title" | "dueAt">): Task {
  return {
    className: "English",
    type: "homework",
    estimatedMinutes: 120,
    remainingMinutes: 120,
    difficulty: "medium",
    priority: "medium",
    canSplit: true,
    completed: false,
    createdAt: now.toISOString(),
    ...partial,
  };
}

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    preferences: DEFAULT_PREFERENCES,
    events: [],
    tasks: [],
    blocks: [],
    warnings: [],
    lastPlannedAt: null,
    planReady: false,
    dismissedNotificationIds: [],
    ...overrides,
  };
}

function dueIn(days: number, time = "21:00"): string {
  return combineDateAndTime(addDays(startOfDay(now), days), time).toISOString();
}

const failures: string[] = [];
function assert(name: string, ok: boolean, detail = "") {
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

const evenings = state({
  events: [
    {
      id: "school",
      title: "School",
      category: "school",
      startTime: "08:00",
      endTime: "15:00",
      daysOfWeek: [1, 2, 3, 4, 5],
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    },
  ],
  tasks: [
    task({
      id: "essay",
      title: "English Essay",
      type: "project",
      dueAt: dueIn(5),
      estimatedMinutes: 240,
      remainingMinutes: 240,
    }),
  ],
});
const spread = createTaskPlan(evenings.tasks[0], evenings, now);
const daysUsed = new Set(spread.sessions.map((s) => s.dateKey));
assert("TEST 1 spread days", daysUsed.size >= 2, `got ${daysUsed.size} days, ${spread.sessions.length} sessions`);

const tight = state({
  events: [
    {
      id: "packed",
      title: "Packed day",
      category: "other",
      startTime: "07:00",
      endTime: "22:00",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    },
  ],
  tasks: [task({ id: "hw", title: "Lab report", dueAt: dueIn(1), remainingMinutes: 180, estimatedMinutes: 180 })],
});
assert("TEST 2 warn insufficient", createTaskPlan(tight.tasks[0], tight, now).status === "behind");

const testPrep = state({
  events: evenings.events,
  tasks: [
    task({
      id: "math-test",
      title: "Math Test",
      type: "test",
      dueAt: dueIn(4, "08:00"),
      estimatedMinutes: 120,
      remainingMinutes: 120,
    }),
  ],
});
const study = createStudyPlan(testPrep.tasks[0], testPrep, now);
assert("TEST 3 multi study", study.sessions.length >= 2, `got ${study.sessions.length}`);

const openEvening = state({
  events: [
    ...evenings.events,
    {
      id: "until-six",
      title: "Afternoon commitments",
      category: "other",
      startTime: "15:10",
      endTime: "18:00",
      daysOfWeek: [1, 2, 3, 4, 5],
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    },
  ],
  tasks: [task({ id: "math-hw", title: "Math homework", dueAt: dueIn(2), remainingMinutes: 45, estimatedMinutes: 45 })],
});
const action = getTodayActionPlan(openEvening, now);
assert(
  "TEST 4 names tonight window",
  Boolean(action?.headline.includes("Tonight") && (action.slot.startMin === 18 * 60 || action.headline.includes("6:00"))),
  action?.headline ?? "no action",
);
assert("TEST 4 recommends work", (action?.uses.length ?? 0) > 0);

const basketball = state({
  events: [
    ...evenings.events,
    {
      id: "bball",
      title: "Basketball",
      category: "sports",
      startTime: "17:00",
      endTime: "18:30",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    },
  ],
  tasks: [task({ id: "sci", title: "Science", dueAt: dueIn(3) })],
});
const free = calculateFreeTime(basketball, startOfDay(now), { now });
const overlapsPractice = free.some((slot) => slot.startMin < 18 * 60 + 30 && slot.endMin > 17 * 60);
assert("TEST 5 no basketball overlap", !overlapsPractice, JSON.stringify(free.map((s) => `${s.startMin}-${s.endMin}`)));

const done = state({
  tasks: [task({ id: "done", title: "Finished essay", dueAt: dueIn(2), completed: true, remainingMinutes: 0 })],
});
assert("TEST 6 no completed reminders", generateDeadlineReminders(done, now).length === 0);

const once = generatePlanningNotifications(evenings, now);
const ids = once.map((n) => n.id);
assert("TEST 7 unique ids", ids.length === new Set(ids).size);
const dismissed = generatePlanningNotifications(
  { ...evenings, dismissedNotificationIds: ids },
  now,
);
assert("TEST 7 dismissed stay gone", dismissed.every((n) => !ids.includes(n.id)));

const busyBlock = state({
  events: evenings.events,
  tasks: [
    task({ id: "a", title: "Due tomorrow", dueAt: dueIn(1), remainingMinutes: 60, estimatedMinutes: 60, priority: "high" }),
    task({ id: "b", title: "Due next week", dueAt: dueIn(6), remainingMinutes: 30, estimatedMinutes: 30, priority: "low" }),
  ],
});
const filled = getTodayActionPlan(busyBlock, now);
assert("TEST 8 prioritizes sooner work", filled?.uses[0]?.taskId === "a", filled?.uses[0]?.title);

const sunday = combineDateAndTime(startOfDay(new Date("2026-09-20T12:00:00")), "12:00");
const crowded = state({
  events: [],
  tasks: [
    task({ id: "algebra", title: "Algebra", dueAt: combineDateAndTime(addDays(startOfDay(sunday), 1), "08:00").toISOString(), remainingMinutes: 40, estimatedMinutes: 40, canSplit: false }),
    task({ id: "history", title: "History", type: "project", dueAt: combineDateAndTime(addDays(startOfDay(sunday), 3), "23:59").toISOString(), remainingMinutes: 50, estimatedMinutes: 50, canSplit: true }),
    task({ id: "chem", title: "Chemistry", type: "quiz", dueAt: combineDateAndTime(addDays(startOfDay(sunday), 3), "08:00").toISOString(), remainingMinutes: 50, estimatedMinutes: 50, canSplit: true }),
    task({ id: "spanish", title: "Spanish", type: "quiz", dueAt: combineDateAndTime(addDays(startOfDay(sunday), 2), "08:00").toISOString(), remainingMinutes: 35, estimatedMinutes: 35, canSplit: false }),
  ],
});
const reserved = buildReservedSchedule(crowded, sunday);
const allSessions = reserved.flatMap((plan) => plan.sessions);
let overlap = false;
for (let i = 0; i < allSessions.length; i += 1) {
  for (let j = i + 1; j < allSessions.length; j += 1) {
    const a = allSessions[i];
    const b = allSessions[j];
    if (a.dateKey !== b.dateKey || a.startMin == null || a.endMin == null || b.startMin == null || b.endMin == null) continue;
    if (a.startMin < b.endMin && b.startMin < a.endMin) overlap = true;
  }
}
assert("TEST 9 zero overlapping sessions", !overlap, allSessions.map((s) => `${s.title} ${s.dateKey} ${s.startMin}-${s.endMin}`).join(" | "));
const chemSessions = reserved.find((p) => p.task.id === "chem")?.sessions.filter((s) => s.dateKey === toISODate(sunday)) ?? [];
  assert("TEST 11 chemistry not split twice today", chemSessions.length <= 1, `${chemSessions.length} chem sessions`);
  assert(
    "TEST 12 no 7am homework",
    allSessions.every((s) => (s.startMin ?? 0) >= 8 * 60),
    allSessions.map((s) => `${s.title} ${s.startMin}`).join(","),
  );
  const smartCrowded = buildSmartSchedule(crowded, sunday);
  const sundayWork = smartCrowded.plans.flatMap((p) => p.sessions.filter((s) => s.dateKey === toISODate(sunday))).sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0));
  const sundayBreaks = smartCrowded.breaks.filter((b) => b.dateKey === toISODate(sunday));
  assert("TEST 13 breaks between work", sundayWork.length < 2 || sundayBreaks.length >= 1, `work=${sundayWork.length} breaks=${sundayBreaks.length}`);
  assert(
    "TEST 14 no tiny sessions",
    allSessions.every((s) => s.minutes >= 20 || s.minutes >= 15),
  );

const shortEnglish = state({
  preferences: { ...DEFAULT_PREFERENCES, wakeTime: "08:00" },
  events: [
    {
      id: "busy-sun",
      title: "Busy",
      category: "other",
      startTime: "08:00",
      endTime: "12:00",
      daysOfWeek: [0],
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    },
    {
      id: "busy-sun-2",
      title: "Busy later",
      category: "other",
      startTime: "12:50",
      endTime: "22:00",
      daysOfWeek: [0],
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    },
  ],
  tasks: [
    task({
      id: "english",
      title: "English chapter 6–7",
      dueAt: combineDateAndTime(addDays(startOfDay(sunday), 1), "08:00").toISOString(),
      remainingMinutes: 60,
      estimatedMinutes: 60,
    }),
  ],
});
const englishPlan = createTaskPlan(shortEnglish.tasks[0], shortEnglish, sunday);
assert("TEST 10 at risk when short", englishPlan.atRisk && englishPlan.shortBy >= 10, `shortBy=${englishPlan.shortBy} available=${englishPlan.availableBeforeDeadline} planned=${englishPlan.planned}`);
assert(
  "TEST 10 sessions before deadline",
  englishPlan.sessions.every((session) => (session.endMin ?? 0) <= 8 * 60 || session.dateKey !== toISODate(addDays(startOfDay(sunday), 1))),
);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("All 8 planning scenarios passed.");
console.log(`TEST 1 sessions: ${spread.sessions.map((s) => `${s.dateKey} ${s.label}`).join(" | ")}`);
console.log(`TEST 4 headline: ${action?.headline}`);
console.log(`Today ${toISODate(now)} first free after basketball at ${free[0]?.startMin}`);
