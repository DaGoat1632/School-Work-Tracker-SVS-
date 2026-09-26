"use client";

import { useStore } from "@/lib/store";

export default function SettingsPage() {
  const { state, updatePreferences, resetDemo } = useStore();
  const prefs = state.preferences;

  return (
    <main className="grid gap-6 md:grid-cols-2">
      <section className="card p-5">
        <h2 className="text-lg">Profile and limits</h2>
        <div className="grid-form mt-4">
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            Your name
            <input
              value={prefs.studentName}
              onChange={(event) =>
                updatePreferences({ studentName: event.target.value })
              }
            />
          </label>
          <label className="field">
            Wake
            <input
              type="time"
              value={prefs.wakeTime}
              onChange={(event) =>
                updatePreferences({ wakeTime: event.target.value })
              }
            />
          </label>
          <label className="field">
            Sleep
            <input
              type="time"
              value={prefs.sleepTime}
              onChange={(event) =>
                updatePreferences({ sleepTime: event.target.value })
              }
            />
          </label>
          <label className="field">
            No work after
            <input
              type="time"
              value={prefs.noWorkAfter}
              onChange={(event) =>
                updatePreferences({ noWorkAfter: event.target.value })
              }
            />
          </label>
          <label className="field">
            Work block length (min)
            <input
              type="number"
              min={20}
              max={120}
              value={prefs.workBlockMinutes}
              onChange={(event) =>
                updatePreferences({
                  workBlockMinutes: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="field">
            Break between blocks (min)
            <input
              type="number"
              min={0}
              max={30}
              value={prefs.breakMinutes}
              onChange={(event) =>
                updatePreferences({ breakMinutes: Number(event.target.value) })
              }
            />
          </label>
          <label className="field">
            Max weeknight work (min)
            <input
              type="number"
              min={30}
              value={prefs.maxWeeknightMinutes}
              onChange={(event) =>
                updatePreferences({
                  maxWeeknightMinutes: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="field">
            Max weekend work (min)
            <input
              type="number"
              min={30}
              value={prefs.maxWeekendMinutes}
              onChange={(event) =>
                updatePreferences({
                  maxWeekendMinutes: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="text-lg">How planning works</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-[var(--ink-soft)]">
          <li>Add work, extracurriculars, sports, and other fixed time.</li>
          <li>Open Weekly and press Generate plan.</li>
          <li>
            Schedi builds today, tomorrow, next week, and the week after.
          </li>
          <li>Check off blocks as you finish. Rebuild when life changes.</li>
        </ol>
        <button className="btn secondary mt-6" onClick={resetDemo}>
          Reset to sample week (clears the plan)
        </button>
      </section>
    </main>
  );
}
