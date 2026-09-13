import type { AppState, FixedEvent, Task } from "./types";
import { addDays, combineDateAndTime, startOfDay, toISODate, weekday } from "./time";

const LOOKAHEAD_DAYS = 28;

export type UpcomingTest = {
  task: Task;
  due: Date;
};

export type UpcomingClass = {
  event: FixedEvent;
  start: Date;
  end: Date;
};

function eventMatchesDay(event: FixedEvent, day: Date): boolean {
  const key = toISODate(day);
  if (event.specificDate) return event.specificDate === key;
  return event.daysOfWeek.includes(weekday(day));
}

export function upcomingTests(state: AppState, now = new Date()): UpcomingTest[] {
  const horizon = addDays(startOfDay(now), LOOKAHEAD_DAYS);
  return state.tasks
    .filter((task) => {
      if (task.completed) return false;
      if (task.type !== "test" && task.type !== "quiz") return false;
      const due = new Date(task.dueAt);
      return due >= now && due <= horizon;
    })
    .map((task) => ({ task, due: new Date(task.dueAt) }))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

export function upcomingClasses(state: AppState, now = new Date()): UpcomingClass[] {
  const classes = state.events.filter((event) => event.category === "school");
  const items: UpcomingClass[] = [];
  const today = startOfDay(now);

  for (let i = 0; i < LOOKAHEAD_DAYS; i += 1) {
    const day = addDays(today, i);
    for (const event of classes) {
      if (!eventMatchesDay(event, day)) continue;
      const start = combineDateAndTime(day, event.startTime);
      const end = combineDateAndTime(day, event.endTime);
      if (end < now) continue;
      items.push({ event, start, end });
    }
  }

  return items.sort((a, b) => a.start.getTime() - b.start.getTime());
}
