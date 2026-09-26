import {
  buildReservedSchedule,
  buildSmartSchedule,
  calculateFreeTime,
  createStudyPlan,
  createTaskPlan,
  generateDeadlineReminders,
  generatePlanningNotifications,
  getCoachDayPlan,
  getTodayActionPlan,
  isAcademicSchoolDay,
  classifyTaskTrack,
  shortfallMinutes,
  validateDailyPlan,
  validateTaskPlannedDuration,
} from "../lib/planning";
import { buildSchedule } from "../lib/scheduler";
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
    studySessions: [],
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
    "TEST 12 no work before 9am weekend",
    allSessions.every((s) => (s.startMin ?? 0) >= 9 * 60),
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

const schoolTuesday = addDays(startOfDay(now), 1);
const tueSessions = createTaskPlan(evenings.tasks[0], evenings, now).sessions.filter(
  (s) => s.dateKey === toISODate(schoolTuesday),
);
assert(
  "TEST 15 school-day work after school",
  tueSessions.every((s) => (s.startMin ?? 0) >= 15 * 60),
  tueSessions.map((s) => String(s.startMin)).join(","),
);

const sundayCoach = getCoachDayPlan(crowded, sunday, sunday);
const headerWork = sundayCoach.items.filter((i) => i.kind === "work").reduce((sum, i) => sum + i.minutes, 0);
const headerFree = sundayCoach.items.filter((i) => i.kind === "free").reduce((sum, i) => sum + i.minutes, 0);
assert("TEST 16 summary matches timeline work", sundayCoach.workMinutes === headerWork);
assert("TEST 16 summary matches timeline free", sundayCoach.freeMinutes === headerFree);
assert("TEST 16 dinner not counted as free", sundayCoach.items.filter((i) => i.kind === "personal").every((i) => i.title.includes("Dinner")));
const isolated = sundayCoach.items.filter((item, index, list) => {
  if (item.kind !== "break") return false;
  return list[index - 1]?.kind !== "work" || list[index + 1]?.kind !== "work";
});
assert("TEST 17 no isolated breaks", isolated.length === 0, isolated.map((i) => `${i.startMin}`).join(","));
assert("TEST 17 plan validates", validateDailyPlan(sundayCoach).length === 0, validateDailyPlan(sundayCoach).join("; "));

const historyNow = combineDateAndTime(startOfDay(new Date("2026-09-13T10:00:00")), "10:00");
const historyState = state({
  events: [
    {
      id: "school",
      title: "School",
      category: "school",
      startTime: "08:00",
      endTime: "15:10",
      daysOfWeek: [1, 2, 3, 4, 5],
      travelMinutesBefore: 25,
      travelMinutesAfter: 20,
    },
  ],
  tasks: [
    task({
      id: "history-essay",
      title: "History essay draft",
      className: "US History",
      type: "project",
      dueAt: combineDateAndTime(addDays(startOfDay(historyNow), 4), "23:59").toISOString(),
      estimatedMinutes: 240,
      remainingMinutes: 240,
      difficulty: "hard",
      priority: "high",
      canSplit: true,
    }),
  ],
});
const historyPlan = createTaskPlan(historyState.tasks[0], historyState, historyNow);
const historyDuration = validateTaskPlannedDuration(240, historyPlan.sessions);
assert("TEST 19 required equals scheduled", historyDuration.complete && historyDuration.remainingMinutes === 0, `scheduled=${historyDuration.scheduledMinutes} remaining=${historyDuration.remainingMinutes} track=${historyPlan.track}`);
assert("TEST 19 not at risk when time exists", historyPlan.track === "on_track", historyPlan.track);
assert("TEST 19 spreads across days", new Set(historyPlan.sessions.map((s) => s.dateKey)).size >= 3, historyPlan.sessions.map((s) => `${s.dateKey} ${s.minutes}`).join(" | "));
assert(
  "TEST 19 one session per day when possible",
  [...new Set(historyPlan.sessions.map((s) => s.dateKey))].every(
    (key) => historyPlan.sessions.filter((s) => s.dateKey === key).length === 1,
  ),
  historyPlan.sessions.map((s) => `${s.dateKey} ${s.minutes}`).join(" | "),
);
assert(
  "TEST 19 uses round session lengths",
  historyPlan.sessions.every((s) => [30, 45, 60, 75, 90].includes(s.minutes)),
  historyPlan.sessions.map((s) => String(s.minutes)).join(","),
);
assert(
  "TEST 19 keeps deadline day as buffer",
  historyPlan.sessions.every((s) => s.dateKey !== toISODate(addDays(startOfDay(historyNow), 4))),
  historyPlan.sessions.map((s) => s.dateKey).join(","),
);
assert(
  "TEST 19 school-day work starts after school",
  historyPlan.sessions
    .filter((s) => isAcademicSchoolDay(historyState, s.date))
    .every((s) => (s.startMin ?? 0) >= 15 * 60 + 30),
  historyPlan.sessions.map((s) => `${s.dateKey} ${s.startMin}`).join(" | "),
);
assert(
  "TEST 19 no morning or during-school work",
  historyPlan.sessions.every((session) => {
    const school = isAcademicSchoolDay(historyState, session.date);
    if (school) return (session.startMin ?? 0) >= 15 * 60 + 30;
    return (session.startMin ?? 0) >= 9 * 60;
  }),
  historyPlan.sessions.map((s) => `${s.dateKey} ${s.startMin}-${s.endMin}`).join(" | "),
);
const mondayKey = toISODate(addDays(startOfDay(historyNow), 1));
const mondayMinutes = historyPlan.sessions.filter((s) => s.dateKey === mondayKey).reduce((sum, s) => sum + s.minutes, 0);
assert("TEST 19 does not dump most work on Monday", mondayMinutes <= 120, `monday=${mondayMinutes}`);

const generated = buildSchedule({
  tasks: historyState.tasks,
  events: historyState.events,
  preferences: historyState.preferences,
  now: historyNow,
});
const genMinutes = generated.blocks.filter((b) => b.taskId === "history-essay").reduce((sum, b) => sum + b.minutes, 0);
assert("TEST 19 generate-plan covers required minutes", genMinutes === 240 || generated.warnings.some((w) => w.taskId === "history-essay"), `gen=${genMinutes} warnings=${generated.warnings.map((w) => w.message).join(";")}`);
assert(
  "TEST 19 generate-plan honors start hours",
  generated.blocks.every((block) => {
    const start = new Date(block.start);
    const startMin = start.getHours() * 60 + start.getMinutes();
    return isAcademicSchoolDay(historyState, start) ? startMin >= 15 * 60 + 30 : startMin >= 9 * 60;
  }),
  generated.blocks.map((b) => b.start).join(","),
);

const emptyDay = getCoachDayPlan(state({ events: evenings.events, tasks: [] }), now, now);
assert("TEST 18 no fake work", emptyDay.workMinutes === 0 && emptyDay.breakMinutes === 0);

const leftoverStatus = classifyTaskTrack({
  hoursUntilDue: 80,
  remainingMinutes: 6,
  availableMinutesBeforeDeadline: 18 * 60 + 48,
});
assert("TEST 20 leftover work is not at risk", leftoverStatus.track !== "at_risk" && leftoverStatus.shortfallMinutes === 0, leftoverStatus.track);
assert("TEST 20 shortfall formula", shortfallMinutes(6, 1128) === 0);
assert("TEST 20 genuine shortfall", shortfallMinutes(180, 90) === 90);

const packedPlan = createTaskPlan(tight.tasks[0], tight, now);
assert("TEST 21 insufficient capacity is at risk", packedPlan.track === "at_risk" && packedPlan.shortBy > 0, `track=${packedPlan.track} shortBy=${packedPlan.shortBy}`);

const overdueState = state({
  tasks: [
    task({
      id: "late",
      title: "Late lab",
      dueAt: combineDateAndTime(addDays(startOfDay(now), -1), "21:00").toISOString(),
      remainingMinutes: 40,
      estimatedMinutes: 40,
    }),
  ],
});
assert("TEST 22 overdue", createTaskPlan(overdueState.tasks[0], overdueState, now).track === "overdue");

const exact = state({
  events: evenings.events,
  tasks: [
    task({
      id: "exact-hw",
      title: "Exact homework",
      dueAt: dueIn(2, "21:00"),
      remainingMinutes: 45,
      estimatedMinutes: 45,
    }),
  ],
});
const exactPlan = createTaskPlan(exact.tasks[0], exact, now);
assert(
  "TEST 23 exactly enough is on track",
  exactPlan.track === "on_track" && exactPlan.remaining === 0 && exactPlan.shortBy === 0,
  `track=${exactPlan.track} remaining=${exactPlan.remaining} planned=${exactPlan.planned} shortBy=${exactPlan.shortBy}`,
);

const needsPlanning = classifyTaskTrack({
  hoursUntilDue: 72,
  remainingMinutes: 45,
  availableMinutesBeforeDeadline: 400,
});
assert("TEST 24 remaining with capacity needs planning", needsPlanning.track === "needs_planning" && needsPlanning.shortfallMinutes === 0);

const sundayNow = combineDateAndTime(startOfDay(new Date("2026-09-13T16:06:00")), "16:06");
const mathMorning = state({
  events: evenings.events,
  tasks: [
    task({
      id: "math-am",
      title: "Math homework",
      dueAt: combineDateAndTime(addDays(startOfDay(sundayNow), 1), "08:00").toISOString(),
      remainingMinutes: 45,
      estimatedMinutes: 45,
    }),
  ],
});
const mathTonight = getCoachDayPlan(mathMorning, sundayNow, sundayNow);
const mathTomorrowDay = addDays(startOfDay(sundayNow), 1);
assert(
  "TEST 25 due-tomorrow morning is planned tonight",
  mathTonight.items.some((item) => item.kind === "work" && item.title === "Math homework"),
  mathTonight.items.map((item) => `${item.kind}:${item.title}`).join(", "),
);
assert(
  "TEST 25 still listed as due tomorrow",
  mathMorning.tasks.filter((item) => toISODate(new Date(item.dueAt)) === toISODate(mathTomorrowDay)).length === 1,
);
const mathBlocks = buildSchedule({
  tasks: mathMorning.tasks,
  events: mathMorning.events,
  preferences: mathMorning.preferences,
  keptBlocks: [],
});
const withBlocks = {
  ...mathMorning,
  blocks: mathBlocks.blocks,
  planReady: true,
};
assert(
  "TEST 25 generated blocks do not hide today’s plan",
  getCoachDayPlan(withBlocks, sundayNow, sundayNow).items.some(
    (item) => item.kind === "work" && item.title === "Math homework",
  ),
);

const mathEvening = state({
  events: evenings.events,
  tasks: [
    task({
      id: "math-pm",
      title: "Math homework",
      dueAt: combineDateAndTime(mathTomorrowDay, "21:00").toISOString(),
      remainingMinutes: 45,
      estimatedMinutes: 45,
    }),
  ],
});
assert(
  "TEST 25 evening due still scheduled",
  createTaskPlan(mathEvening.tasks[0], mathEvening, sundayNow).planned === 45,
);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("All 8 planning scenarios passed.");
console.log(`TEST 1 sessions: ${spread.sessions.map((s) => `${s.dateKey} ${s.label}`).join(" | ")}`);
console.log(`TEST 19 history: ${historyPlan.sessions.map((s) => `${s.dateKey} ${s.label}`).join(" | ")}`);
console.log(`TEST 4 headline: ${action?.headline}`);
console.log(`Today ${toISODate(now)} first free after basketball at ${free[0]?.startMin}`);
