import { DEFAULT_PREFERENCES } from "./types";
import type { AppState, FixedEvent, Task } from "./types";
import { combineDateAndTime, uid } from "./time";

export function dueOnSep25(time: string): string {
  return combineDateAndTime(new Date(2026, 8, 25), time).toISOString();
}

export function createSeedState(): AppState {
  const events: FixedEvent[] = [
    {
      id: uid(),
      title: "School",
      category: "school",
      startTime: "08:00",
      endTime: "15:10",
      daysOfWeek: [1, 2, 3, 4, 5],
      travelMinutesBefore: 25,
      travelMinutesAfter: 20,
    },
    {
      id: uid(),
      title: "Soccer practice",
      category: "sports",
      startTime: "16:30",
      endTime: "18:00",
      daysOfWeek: [2, 4],
      travelMinutesBefore: 15,
      travelMinutesAfter: 20,
    },
    {
      id: uid(),
      title: "Robotics club",
      category: "club",
      startTime: "15:30",
      endTime: "17:00",
      daysOfWeek: [3],
      travelMinutesBefore: 10,
      travelMinutesAfter: 15,
    },
  ];

  const now = new Date().toISOString();
  const tasks: Task[] = [
    {
      id: uid(),
      title: "History essay draft",
      className: "US History",
      type: "project",
      dueAt: dueOnSep25("23:59"),
      estimatedMinutes: 240,
      remainingMinutes: 240,
      difficulty: "hard",
      priority: "high",
      canSplit: true,
      completed: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: "Chemistry quiz prep",
      className: "Chemistry",
      type: "quiz",
      dueAt: dueOnSep25("08:00"),
      estimatedMinutes: 90,
      remainingMinutes: 90,
      difficulty: "hard",
      priority: "high",
      canSplit: true,
      completed: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: "Spanish vocab quiz",
      className: "Spanish",
      type: "quiz",
      dueAt: dueOnSep25("08:00"),
      estimatedMinutes: 35,
      remainingMinutes: 35,
      difficulty: "easy",
      priority: "medium",
      canSplit: false,
      completed: false,
      createdAt: now,
    },
  ];

  return {
    preferences: { ...DEFAULT_PREFERENCES, studentName: "Pratham" },
    events,
    tasks,
    blocks: [],
    warnings: [],
    studySessions: [],
    lastPlannedAt: null,
    planReady: false,
    dismissedNotificationIds: [],
  };
}
