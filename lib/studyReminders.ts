import { addDays, startOfDay, toISODate } from "./time";
import type { AppState, PlanningNotification } from "./types";

function durationPhrase(startMin: number, endMin: number): string {
  const minutes = Math.max(0, endMin - startMin);
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
}

export function studySessionReminders(
  state: AppState,
  now = new Date(),
): PlanningNotification[] {
  const notes: PlanningNotification[] = [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayKey = toISODate(now);
  const yesterdayKey = toISODate(addDays(startOfDay(now), -1));

  for (const session of state.studySessions) {
    if (session.completed) continue;
    const task = state.tasks.find((item) => item.id === session.taskId);
    if (!task || task.completed) continue;
    const name = task.title;

    if (session.dateKey === todayKey && !session.skipped) {
      if (nowMin >= session.startMin - 60 && nowMin < session.startMin) {
        notes.push({
          id: `study-soon:${session.id}:${todayKey}`,
          kind: "deadline",
          urgency: "important",
          title: `Study session in 1 hour — ${name}`,
          message: `${session.startTime}–${session.endTime}`,
        });
      }
      if (nowMin >= session.startMin && nowMin < session.endMin) {
        notes.push({
          id: `study-now:${session.id}:${todayKey}`,
          kind: "freetime",
          urgency: "urgent",
          title: `Time to study! ${name} · ${durationPhrase(session.startMin, session.endMin)}`,
          message: session.focus || "Study session",
        });
      }
    }

    const missedYesterday =
      session.dateKey === yesterdayKey && (session.skipped || nowMin >= 7 * 60);
    if (missedYesterday) {
      notes.push({
        id: `study-missed:${session.id}:${yesterdayKey}`,
        kind: "overdue",
        urgency: "urgent",
        title: `You missed your ${name} study session. Want to reschedule?`,
        message: "Open the task to regenerate the plan around the time you still have.",
      });
    }
  }

  return notes;
}
