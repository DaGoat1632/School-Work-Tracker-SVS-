import type { EventCategory, TaskType } from "./types";
import type { FixedEvent } from "./types";
import { minutesFromMidnight } from "./time";

export const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "homework", label: "Homework" },
  { value: "project", label: "Project" },
  { value: "quiz", label: "Quiz" },
  { value: "test", label: "Test" },
  { value: "reading", label: "Reading" },
  { value: "other", label: "Other" },
];

export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "school", label: "School" },
  { value: "sports", label: "Sports" },
  { value: "club", label: "Club" },
  { value: "job", label: "Job" },
  { value: "family", label: "Family" },
  { value: "commute", label: "Commute" },
  { value: "other", label: "Other" },
];

export function eventColor(category: EventCategory): string {
  switch (category) {
    case "school":
      return "var(--school)";
    case "sports":
      return "var(--sports)";
    case "club":
      return "var(--club)";
    case "job":
      return "var(--job)";
    case "family":
      return "var(--family)";
    case "commute":
      return "var(--travel)";
    default:
      return "var(--ink-soft)";
  }
}

export function eventIntervalsForDay(
  events: FixedEvent[],
  dayIndex: number,
  dateKey: string,
) {
  return events.flatMap((event) => {
    const matches = event.specificDate
      ? event.specificDate === dateKey
      : event.daysOfWeek.includes(dayIndex);
    if (!matches) return [];
    const start = minutesFromMidnight(event.startTime);
    const end = minutesFromMidnight(event.endTime);
    const travelBefore = event.travelMinutesBefore
      ? [
          {
            id: `${event.id}-travel-before`,
            title: `Travel to ${event.title}`,
            kind: "travel" as const,
            start: start - event.travelMinutesBefore,
            end: start,
            color: "var(--travel)",
          },
        ]
      : [];
    const travelAfter = event.travelMinutesAfter
      ? [
          {
            id: `${event.id}-travel-after`,
            title: `Travel from ${event.title}`,
            kind: "travel" as const,
            start: end,
            end: end + event.travelMinutesAfter,
            color: "var(--travel)",
          },
        ]
      : [];
    return [
      ...travelBefore,
      {
        id: event.id,
        title: event.title,
        kind: "event" as const,
        start,
        end,
        color: eventColor(event.category),
      },
      ...travelAfter,
    ];
  });
}
