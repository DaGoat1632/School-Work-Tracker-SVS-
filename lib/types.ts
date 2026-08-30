export type Difficulty = "easy" | "medium" | "hard";
export type TaskType =
  | "homework"
  | "project"
  | "quiz"
  | "test"
  | "reading"
  | "other";
export type EventCategory =
  | "school"
  | "sports"
  | "club"
  | "job"
  | "family"
  | "commute"
  | "other";
export type BlockStatus = "planned" | "done" | "skipped" | "partial";

export type Preferences = {
  studentName: string;
  wakeTime: string;
  sleepTime: string;
  noWorkAfter: string;
  maxWeeknightMinutes: number;
  maxWeekendMinutes: number;
  workBlockMinutes: number;
  breakMinutes: number;
};

export type FixedEvent = {
  id: string;
  title: string;
  category: EventCategory;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  specificDate?: string;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
};

export type Task = {
  id: string;
  title: string;
  className: string;
  type: TaskType;
  dueAt: string;
  estimatedMinutes: number;
  remainingMinutes: number;
  difficulty: Difficulty;
  canSplit: boolean;
  completed: boolean;
  createdAt: string;
};

export type ScheduledBlock = {
  id: string;
  taskId: string;
  title: string;
  start: string;
  end: string;
  minutes: number;
  status: BlockStatus;
  completedMinutes?: number;
};

export type Warning = {
  type: "overload" | "tight" | "past_due";
  taskId?: string;
  message: string;
};

export type AppState = {
  preferences: Preferences;
  events: FixedEvent[];
  tasks: Task[];
  blocks: ScheduledBlock[];
  warnings: Warning[];
  lastPlannedAt: string | null;
  planReady: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  studentName: "there",
  wakeTime: "07:00",
  sleepTime: "23:00",
  noWorkAfter: "22:00",
  maxWeeknightMinutes: 180,
  maxWeekendMinutes: 240,
  workBlockMinutes: 50,
  breakMinutes: 10,
};
