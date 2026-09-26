"use client";

import { generatePlanningNotifications } from "@/lib/planning";
import { studySessionReminders } from "@/lib/studyReminders";
import { useStore } from "@/lib/store";

function calm(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
}

export default function RemindersPage() {
  const { state, dismissNotification } = useStore();
  const notes = [
    ...studySessionReminders(state),
    ...generatePlanningNotifications(state),
  ];

  if (notes.length === 0) {
    return (
      <div className="card p-5 text-sm text-[var(--ink-soft)]">
        Nothing waiting. You are clear for now.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="chip mb-2">
                {note.urgency === "urgent"
                  ? "Urgent"
                  : note.urgency === "important"
                    ? "Soon"
                    : "OK"}
              </p>
              <p className="text-sm">{calm(note.title)}</p>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">{calm(note.message)}</p>
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={() => dismissNotification(note.id)}
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
