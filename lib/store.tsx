"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { snapStudyClockMins, formatClock, toTimeInput } from "./format";
import { studySessionsFromPlan } from "./aiStudyPlan";
import { fitPlanToNeededMinutes } from "./placeStudyPlan";
import { buildSchedule } from "./scheduler";
import { createSeedState } from "./seed";
import { uid } from "./time";
import { DEFAULT_PREFERENCES } from "./types";
import type {
  AiStudyPlan,
  AppState,
  FixedEvent,
  Preferences,
  ScheduledBlock,
  StudySession,
  Task,
} from "./types";

const EMPTY_STATE: AppState = {
  preferences: DEFAULT_PREFERENCES,
  events: [],
  tasks: [],
  blocks: [],
  studySessions: [],
  warnings: [],
  lastPlannedAt: null,
  planReady: false,
  dismissedNotificationIds: [],
};

const STORAGE_KEY = "stride-student-planner-v2";

const DROP_TASK_TITLES = new Set([
  "algebra worksheet 4.2",
  "math homework",
  "english chapter 6-7",
  "math test preparation",
  "math test prep",
]);

const DROP_ALGEBRA_TEST_ONCE_KEY = "stride-dropped-algebra-test-once";

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/[–—]/g, "-");
}

function dropTasksByIds(state: AppState, droppedIds: Set<string>): AppState {
  if (droppedIds.size === 0) return state;
  return {
    ...state,
    tasks: state.tasks.filter((task) => !droppedIds.has(task.id)),
    blocks: state.blocks.filter((block) => !droppedIds.has(block.taskId)),
    studySessions: state.studySessions.filter((session) => !droppedIds.has(session.taskId)),
  };
}

function withoutDroppedDemoTasks(state: AppState): AppState {
  const droppedIds = new Set(
    state.tasks
      .filter((task) => DROP_TASK_TITLES.has(normalizeTitle(task.title)))
      .map((task) => task.id),
  );
  let next = dropTasksByIds(state, droppedIds);
  if (typeof window !== "undefined" && !window.localStorage.getItem(DROP_ALGEBRA_TEST_ONCE_KEY)) {
    const algebraIds = new Set(
      next.tasks
        .filter((task) => normalizeTitle(task.title) === "algebra test")
        .map((task) => task.id),
    );
    next = dropTasksByIds(next, algebraIds);
    window.localStorage.setItem(DROP_ALGEBRA_TEST_ONCE_KEY, "1");
  }
  return next;
}

type StoreValue = {
  state: AppState;
  hydrated: boolean;
  addTask: (
    input: Omit<Task, "id" | "createdAt" | "remainingMinutes" | "completed">,
  ) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  saveAiPlan: (taskId: string, plan: AiStudyPlan) => void;
  addPlanToSchedule: (taskId: string) => void;
  updateStudySession: (id: string, patch: Partial<StudySession>) => void;
  addEvent: (input: Omit<FixedEvent, "id">) => void;
  updateEvent: (id: string, patch: Partial<FixedEvent>) => void;
  removeEvent: (id: string) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  markBlock: (
    blockId: string,
    status: ScheduledBlock["status"],
    completedMinutes?: number,
  ) => void;
  toggleBlockDone: (blockId: string) => void;
  generatePlan: () => void;
  replan: () => void;
  resetDemo: () => void;
  dismissNotification: (id: string) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

function runPlan(state: AppState): AppState {
  const { blocks, warnings } = buildSchedule({
    tasks: state.tasks,
    events: state.events,
    preferences: state.preferences,
    keptBlocks: state.blocks,
  });
  return {
    ...state,
    blocks,
    warnings,
    planReady: true,
    lastPlannedAt: new Date().toISOString(),
  };
}

function fitSavedStudyPlans(state: AppState): AppState {
  let sessions = [...(state.studySessions ?? [])];
  const tasks = state.tasks.map((task) => {
    if (!task.aiPlan?.plan?.length) return task;
    const need = task.remainingMinutes || task.estimatedMinutes || 30;
    const fitted = fitPlanToNeededMinutes(task.aiPlan, need);
    if (task.planAddedToSchedule) {
      sessions = [
        ...sessions.filter((session) => session.taskId !== task.id),
        ...studySessionsFromPlan(task.id, fitted, [], task.dueAt),
      ];
    }
    return { ...task, aiPlan: fitted };
  });
  sessions = sessions.map((session) => {
    const snapped = snapStudyClockMins(session.startMin, session.endMin);
    return {
      ...session,
      ...snapped,
      startTime: formatClock(toTimeInput(snapped.startMin)),
      endTime: formatClock(toTimeInput(snapped.endMin)),
    };
  });
  return { ...state, tasks, studySessions: sessions };
}

function loadState(): AppState {
  const seed = createSeedState();
  if (typeof window === "undefined") return seed;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return seed;
  try {
    const parsed = JSON.parse(raw) as AppState;
    const merged: AppState = {
      ...seed,
      ...parsed,
      preferences: { ...DEFAULT_PREFERENCES, ...parsed.preferences },
      planReady: Boolean(parsed.planReady),
      dismissedNotificationIds: parsed.dismissedNotificationIds ?? [],
      studySessions: (parsed.studySessions ?? []).map((session) => ({
        ...session,
        userId: session.userId || "local",
      })),
      tasks: (parsed.tasks ?? seed.tasks).map((task) => ({
        ...task,
        priority:
          task.priority ??
          (task.difficulty === "hard"
            ? "high"
            : task.difficulty === "easy"
              ? "low"
              : "medium"),
      })),
    };
    const next = fitSavedStudyPlans(
      withoutDroppedDemoTasks(merged.planReady ? runPlan(merged) : merged),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return seed;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (state === EMPTY_STATE) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      hydrated,
      addTask: (input) => {
        const id = uid();
        setState((current) =>
          runPlan({
            ...current,
            blocks: [],
            warnings: [],
            tasks: [
              ...current.tasks,
              {
                ...input,
                id,
                remainingMinutes: Math.max(0, input.estimatedMinutes || 45),
                estimatedMinutes: Math.max(0, input.estimatedMinutes || 45),
                priority:
                  input.priority ??
                  (input.difficulty === "hard"
                    ? "high"
                    : input.difficulty === "easy"
                      ? "low"
                      : "medium"),
                completed: false,
                createdAt: new Date().toISOString(),
                aiPlan: null,
                planAddedToSchedule: false,
                planGeneratedAt: null,
              },
            ],
          }),
        );
        return id;
      },
      updateTask: (id, patch) => {
        setState((current) =>
          runPlan({
            ...current,
            blocks: [],
            warnings: [],
            tasks: current.tasks.map((task) =>
              task.id === id ? { ...task, ...patch } : task,
            ),
          }),
        );
      },
      removeTask: (id) => {
        setState((current) =>
          runPlan({
            ...current,
            blocks: [],
            warnings: [],
            tasks: current.tasks.filter((task) => task.id !== id),
            studySessions: current.studySessions.filter((session) => session.taskId !== id),
          }),
        );
      },
      saveAiPlan: (taskId, plan) => {
        setState((current) => {
          const task = current.tasks.find((item) => item.id === taskId);
          const need = task?.remainingMinutes || task?.estimatedMinutes || 30;
          const fitted = fitPlanToNeededMinutes(plan, need);
          const sessions = fitted.plan.length
            ? studySessionsFromPlan(taskId, fitted, [], task?.dueAt ?? new Date().toISOString())
            : [];
          return {
            ...current,
            tasks: current.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    aiPlan: fitted,
                    planGeneratedAt: new Date().toISOString(),
                    planAddedToSchedule: sessions.length > 0,
                  }
                : item,
            ),
            studySessions: [
              ...current.studySessions.filter((session) => session.taskId !== taskId),
              ...sessions,
            ],
          };
        });
      },
      addPlanToSchedule: (taskId) => {
        setState((current) => {
          const task = current.tasks.find((item) => item.id === taskId);
          if (!task?.aiPlan) return current;
          const fitted = fitPlanToNeededMinutes(
            task.aiPlan,
            task.remainingMinutes || task.estimatedMinutes || 30,
          );
          const sessions = studySessionsFromPlan(taskId, fitted, [], task.dueAt);
          return {
            ...current,
            tasks: current.tasks.map((item) =>
              item.id === taskId ? { ...item, aiPlan: fitted, planAddedToSchedule: true } : item,
            ),
            studySessions: [
              ...current.studySessions.filter((session) => session.taskId !== taskId),
              ...sessions,
            ],
          };
        });
      },
      updateStudySession: (id, patch) => {
        setState((current) => ({
          ...current,
          studySessions: current.studySessions.map((session) =>
            session.id === id ? { ...session, ...patch } : session,
          ),
        }));
      },
      addEvent: (input) => {
        setState((current) => ({
          ...current,
          planReady: false,
          blocks: [],
          warnings: [],
          lastPlannedAt: null,
          events: [...current.events, { ...input, id: uid() }],
        }));
      },
      updateEvent: (id, patch) => {
        setState((current) => ({
          ...current,
          planReady: false,
          blocks: [],
          warnings: [],
          events: current.events.map((event) =>
            event.id === id ? { ...event, ...patch } : event,
          ),
        }));
      },
      removeEvent: (id) => {
        setState((current) => ({
          ...current,
          planReady: false,
          blocks: [],
          warnings: [],
          events: current.events.filter((event) => event.id !== id),
        }));
      },
      updatePreferences: (patch) => {
        setState((current) => {
          const next = {
            ...current,
            preferences: { ...current.preferences, ...patch },
          };
          return current.planReady ? runPlan(next) : next;
        });
      },
      markBlock: (blockId, status, completedMinutes) => {
        setState((current) => {
          const block = current.blocks.find((item) => item.id === blockId);
          if (!block || !current.planReady) return current;
          const tasks = current.tasks.map((task) => {
            if (task.id !== block.taskId) return task;
            if (status === "done") {
              const remaining = Math.max(0, task.remainingMinutes - block.minutes);
              return {
                ...task,
                remainingMinutes: remaining,
                completed: remaining === 0,
              };
            }
            if (status === "partial") {
              const done = Math.min(completedMinutes ?? 0, block.minutes);
              const remaining = Math.max(0, task.remainingMinutes - done);
              return {
                ...task,
                remainingMinutes: remaining,
                completed: remaining === 0,
              };
            }
            return task;
          });
          const blocks = current.blocks.map((item) =>
            item.id === blockId
              ? { ...item, status, completedMinutes }
              : item,
          );
          return runPlan({ ...current, tasks, blocks });
        });
      },
      toggleBlockDone: (blockId) => {
        setState((current) => {
          const block = current.blocks.find((item) => item.id === blockId);
          if (!block || !current.planReady) return current;

          if (block.status === "done") {
            const tasks = current.tasks.map((task) => {
              if (task.id !== block.taskId) return task;
              const remaining = task.remainingMinutes + block.minutes;
              return {
                ...task,
                remainingMinutes: remaining,
                completed: false,
                estimatedMinutes: Math.max(task.estimatedMinutes, remaining),
              };
            });
            const blocks = current.blocks.map((item) =>
              item.id === blockId
                ? { ...item, status: "planned" as const, completedMinutes: undefined }
                : item,
            );
            return runPlan({ ...current, tasks, blocks });
          }

          const tasks = current.tasks.map((task) => {
            if (task.id !== block.taskId) return task;
            const remaining = Math.max(0, task.remainingMinutes - block.minutes);
            return {
              ...task,
              remainingMinutes: remaining,
              completed: remaining === 0,
            };
          });
          const blocks = current.blocks.map((item) =>
            item.id === blockId ? { ...item, status: "done" as const } : item,
          );
          return runPlan({ ...current, tasks, blocks });
        });
      },
      generatePlan: () => setState((current) => runPlan({ ...current, blocks: [] })),
      replan: () => setState((current) => runPlan(current)),
      resetDemo: () => setState(createSeedState()),
      dismissNotification: (id) => {
        setState((current) => ({
          ...current,
          dismissedNotificationIds: current.dismissedNotificationIds.includes(id)
            ? current.dismissedNotificationIds
            : [...current.dismissedNotificationIds, id],
        }));
      },
    }),
    [state, hydrated],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used within StoreProvider");
  return value;
}
