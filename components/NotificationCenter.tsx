"use client";

import { generatePlanningNotifications } from "@/lib/planning";
import { useStore } from "@/lib/store";

export function NotificationCenter() {
  const { state, dismissNotification } = useStore();
  const notes = generatePlanningNotifications(state);
  if (notes.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="text-2xl">Notifications</h2>
      <p className="mt-1 mb-3 text-sm text-[var(--ink-soft)]">
        Helpful planning messages — dismiss anything you already handled.
      </p>
      <ul className="space-y-2">
        {notes.map((note) => (
          <li key={note.id} className="check-row justify-between">
            <div>
              <p className="chip mb-1">
                {note.urgency === "urgent"
                  ? "Urgent"
                  : note.urgency === "important"
                    ? "Important"
                    : note.urgency === "opportunity"
                      ? "Opportunity"
                      : note.urgency === "ok"
                        ? "On track"
                        : "Upcoming"}
              </p>
              <p className="font-medium">{note.title}</p>
              <p className="text-sm text-[var(--ink-soft)]">{note.message}</p>
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={() => dismissNotification(note.id)}
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
