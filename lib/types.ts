export type Difficulty = "easy" | "medium" | "hard";
export type TaskPriority = "low" | "medium" | "high";
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
export type FreeSize = "short" | "medium" | "long";
export type ReminderUrgency =
  | "urgent"
  | "important"
  | "upcoming"
  | "opportunity"
  | "ok";
export type NotificationKind =
  | "conflict"
  | "test"
  | "overdue"
  | "deadline"
  | "freetime"
  | "getahead"
  | "ahead";

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

export type AiPlanSession = {
  day: string;
  date: string;
  dateKey?: string;
  startTime: string;
  endTime: string;
  duration: string;
  focus: string;
  tip: string;
};

export type AiStudyPlan = {
  plan: AiPlanSession[];
  totalPrepTime: string;
  readyBy: string;
  warningMessage: string | null;
  encouragement: string;
  testDayTip?: string | null;
};

export type StudySession = {
  id: string;
  taskId: string;
  userId: string;
  day: string;
  date: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  startMin: number;
  endMin: number;
  focus: string;
  tip: string;
  completed: boolean;
  skipped: boolean;
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
  priority: TaskPriority;
  canSplit: boolean;
  completed: boolean;
  createdAt: string;
  aiPlan?: AiStudyPlan | null;
  planAddedToSchedule?: boolean;
  planGeneratedAt?: string | null;
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
  type: "overload" | "tight" | "past_due" | "study_short";
  taskId?: string;
  message: string;
};

export type PlanningNotification = {
  id: string;
  kind: NotificationKind;
  urgency: ReminderUrgency;
  title: string;
  message: string;
};

export type AppState = {
  preferences: Preferences;
  events: FixedEvent[];
  tasks: Task[];
  blocks: ScheduledBlock[];
  studySessions: StudySession[];
  warnings: Warning[];
  lastPlannedAt: string | null;
  planReady: boolean;
  dismissedNotificationIds: string[];
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
