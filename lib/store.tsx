"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildSchedule } from "./scheduler";
import { createSeedState } from "./seed";
import { uid } from "./time";
import { DEFAULT_PREFERENCES } from "./types";
import type {
  AppState,
  FixedEvent,
  Preferences,
  ScheduledBlock,
  Task,
} from "./types";

const EMPTY_STATE: AppState = {
  preferences: DEFAULT_PREFERENCES,
  events: [],
  tasks: [],
  blocks: [],
  warnings: [],
  lastPlannedAt: null,
  planReady: false,
};

const STORAGE_KEY = "stride-student-planner-v2";

type StoreValue = {
  state: AppState;
  hydrated: boolean;
  addTask: (
    input: Omit<Task, "id" | "createdAt" | "remainingMinutes" | "completed">,
  ) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
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
    };
    return merged.planReady ? runPlan(merged) : merged;
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      hydrated,
      addTask: (input) => {
        setState((current) => ({
          ...current,
          planReady: false,
          blocks: [],
          warnings: [],
          lastPlannedAt: null,
          tasks: [
            ...current.tasks,
            {
              ...input,
              id: uid(),
              remainingMinutes: input.estimatedMinutes,
              completed: false,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },
      updateTask: (id, patch) => {
        setState((current) => ({
          ...current,
          planReady: false,
          blocks: [],
          warnings: [],
          tasks: current.tasks.map((task) =>
            task.id === id ? { ...task, ...patch } : task,
          ),
        }));
      },
      removeTask: (id) => {
        setState((current) => ({
          ...current,
          planReady: false,
          blocks: [],
          warnings: [],
          tasks: current.tasks.filter((task) => task.id !== id),
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
