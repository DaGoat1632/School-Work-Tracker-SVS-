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
};

const STORAGE_KEY = "stride-student-planner-v1";

type StoreValue = {
  state: AppState;
  hydrated: boolean;
  addTask: (input: Omit<Task, "id" | "createdAt" | "remainingMinutes" | "completed">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addEvent: (input: Omit<FixedEvent, "id">) => void;
  updateEvent: (id: string, patch: Partial<FixedEvent>) => void;
  removeEvent: (id: string) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  markBlock: (blockId: string, status: ScheduledBlock["status"], completedMinutes?: number) => void;
  replan: () => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

function plan(state: AppState): AppState {
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
    lastPlannedAt: new Date().toISOString(),
  };
}

function loadState(): AppState {
  if (typeof window === "undefined") return createSeedState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return plan(createSeedState());
  try {
    const parsed = JSON.parse(raw) as AppState;
    return plan(parsed);
  } catch {
    return plan(createSeedState());
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
        setState((current) =>
          plan({
            ...current,
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
          }),
        );
      },
      updateTask: (id, patch) => {
        setState((current) =>
          plan({
            ...current,
            tasks: current.tasks.map((task) =>
              task.id === id ? { ...task, ...patch } : task,
            ),
          }),
        );
      },
      removeTask: (id) => {
        setState((current) =>
          plan({
            ...current,
            tasks: current.tasks.filter((task) => task.id !== id),
            blocks: current.blocks.filter((block) => block.taskId !== id),
          }),
        );
      },
      addEvent: (input) => {
        setState((current) =>
          plan({
            ...current,
            events: [...current.events, { ...input, id: uid() }],
          }),
        );
      },
      updateEvent: (id, patch) => {
        setState((current) =>
          plan({
            ...current,
            events: current.events.map((event) =>
              event.id === id ? { ...event, ...patch } : event,
            ),
          }),
        );
      },
      removeEvent: (id) => {
        setState((current) =>
          plan({
            ...current,
            events: current.events.filter((event) => event.id !== id),
          }),
        );
      },
      updatePreferences: (patch) => {
        setState((current) =>
          plan({
            ...current,
            preferences: { ...current.preferences, ...patch },
          }),
        );
      },
      markBlock: (blockId, status, completedMinutes) => {
        setState((current) => {
          const block = current.blocks.find((item) => item.id === blockId);
          if (!block) return current;
          const tasks = current.tasks.map((task) => {
            if (task.id !== block.taskId) return task;
            if (status === "done") {
              const remaining = Math.max(0, task.remainingMinutes - block.minutes);
              return { ...task, remainingMinutes: remaining, completed: remaining === 0 };
            }
            if (status === "partial") {
              const done = Math.min(completedMinutes ?? 0, block.minutes);
              const remaining = Math.max(0, task.remainingMinutes - done);
              return { ...task, remainingMinutes: remaining, completed: remaining === 0 };
            }
            return task;
          });
          const blocks = current.blocks.map((item) =>
            item.id === blockId
              ? { ...item, status, completedMinutes }
              : item,
          );
          return plan({ ...current, tasks, blocks });
        });
      },
      replan: () => setState((current) => plan(current)),
      resetDemo: () => setState(plan(createSeedState())),
    }),
    [state, hydrated],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used within StoreProvider");
  return value;
}
