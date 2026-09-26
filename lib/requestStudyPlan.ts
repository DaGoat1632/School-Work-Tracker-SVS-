import { stampPlanDates } from "./aiStudyPlan";
import type { FreeWindow } from "./freeWindows";
import { ensurePlacedPlan, windowsForTask } from "./placeStudyPlan";
import type { AiStudyPlan, FixedEvent, StudySession, Task } from "./types";

export type StudyPlanResponse = {
  ok: boolean;
  plan?: AiStudyPlan;
  windows?: FreeWindow[];
  emergency?: boolean;
  noWindows?: boolean;
  onlyWindow?: FreeWindow;
  message?: string;
  error?: string;
};

export async function requestStudyPlan(input: {
  task: Task;
  events: FixedEvent[];
  studySessions: StudySession[];
}): Promise<StudyPlanResponse> {
  const response = await fetch("/api/study-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: {
        title: input.task.title,
        subject: input.task.className,
        className: input.task.className,
        type: input.task.type,
        dueAt: input.task.dueAt,
        hoursNeeded: ((input.task.remainingMinutes || input.task.estimatedMinutes) || 60) / 60,
        estimatedMinutes: input.task.remainingMinutes || input.task.estimatedMinutes,
        difficulty: input.task.difficulty,
        priority: input.task.priority,
        canSplit: input.task.canSplit,
      },
      events: input.events,
      studySessions: input.studySessions.map((session) => ({
        taskId: session.taskId,
        dateKey: session.dateKey,
        startMin: session.startMin,
        endMin: session.endMin,
      })),
      now: new Date().toISOString(),
      excludeTaskId: input.task.id,
    }),
  });
  try {
    return (await response.json()) as StudyPlanResponse;
  } catch {
    return { ok: false, error: "bad_json" };
  }
}

export async function planHoursForTask(input: {
  task: Task;
  events: FixedEvent[];
  studySessions: StudySession[];
}): Promise<{ plan?: AiStudyPlan; windows: FreeWindow[]; noWindows?: boolean; emergency?: boolean }> {
  const windows = windowsForTask({
    task: input.task,
    events: input.events,
    studySessions: input.studySessions,
  });
  let remote: StudyPlanResponse;
  try {
    remote = await requestStudyPlan(input);
  } catch {
    remote = { ok: false, error: "network" };
  }
  const planWindows = remote.windows?.length ? remote.windows : windows;
  if (planWindows.length === 0) {
    return { noWindows: true, windows: [] };
  }
  const stamped = remote.plan
    ? stampPlanDates(remote.plan, planWindows, input.task.dueAt)
    : undefined;
  const plan = ensurePlacedPlan(input.task, stamped, planWindows);
  if (!plan.plan.length) {
    return { noWindows: true, windows: planWindows };
  }
  return {
    plan,
    windows: planWindows,
    emergency: remote.emergency,
  };
}
