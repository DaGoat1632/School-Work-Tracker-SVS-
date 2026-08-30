import { DEFAULT_PREFERENCES } from "./types";
import type { AppState, FixedEvent, Task } from "./types";
import { addDays, combineDateAndTime, startOfDay, uid } from "./time";

function due(daysFromToday: number, time = "21:00"): string {
  return combineDateAndTime(addDays(startOfDay(new Date()), daysFromToday), time).toISOString();
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
      title: "Algebra worksheet 4.2",
      className: "Algebra II",
      type: "homework",
      dueAt: due(1, "08:00"),
      estimatedMinutes: 40,
      remainingMinutes: 40,
      difficulty: "medium",
      canSplit: false,
      completed: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: "History essay draft",
      className: "US History",
      type: "project",
      dueAt: due(4, "23:59"),
      estimatedMinutes: 240,
      remainingMinutes: 240,
      difficulty: "hard",
      canSplit: true,
      completed: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: "Chemistry quiz prep",
      className: "Chemistry",
      type: "quiz",
      dueAt: due(4, "08:00"),
      estimatedMinutes: 90,
      remainingMinutes: 90,
      difficulty: "hard",
      canSplit: true,
      completed: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: "English chapter 6–7",
      className: "English",
      type: "reading",
      dueAt: due(2, "08:00"),
      estimatedMinutes: 60,
      remainingMinutes: 60,
      difficulty: "easy",
      canSplit: true,
      completed: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: "Spanish vocab quiz",
      className: "Spanish",
      type: "quiz",
      dueAt: due(3, "08:00"),
      estimatedMinutes: 35,
      remainingMinutes: 35,
      difficulty: "easy",
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
    lastPlannedAt: null,
    planReady: false,
  };
}
