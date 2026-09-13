"use client";

import { getUpcomingDeadlines } from "@/lib/planning";
import { useStore } from "@/lib/store";
import { formatDayLabel } from "@/lib/time";

export function UpcomingDeadlines() {
  const days = getUpcomingDeadlines(useStore().state);

  return (
    <section className="card p-5">
      <h2 className="text-2xl">Next 7 days</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--ink-soft)]">
        Deadlines, tests, activities, and open afternoons.
      </p>
      <div className="space-y-4">
        {days.map((day) => (
          <div key={day.dateKey}>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              {formatDayLabel(day.date)}
            </p>
            {day.items.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">Nothing listed.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {day.items.map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    • {item.title}
                    {item.detail ? ` — ${item.detail}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
