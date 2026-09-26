"use client";

import Link from "next/link";
import { formatClock } from "@/lib/format";
import { EVENT_CATEGORIES } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { formatWeekdayLong } from "@/lib/time";

export default function ActivitiesPage() {
  const { state, removeEvent } = useStore();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/add/sports" className="btn secondary">
          Add sports
        </Link>
        <Link href="/add/extracurricular" className="btn secondary">
          Add club
        </Link>
        <Link href="/add/other" className="btn secondary">
          Add class
        </Link>
      </div>

      {state.events.length === 0 && (
        <div className="card p-5 text-sm text-[var(--ink-soft)]">No activities yet.</div>
      )}

      {state.events.map((event) => (
        <article key={event.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm">{event.title}</p>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">
                {EVENT_CATEGORIES.find((item) => item.value === event.category)?.label} ·{" "}
                {formatClock(event.startTime)} – {formatClock(event.endTime)}
                {event.specificDate
                  ? ` · ${event.specificDate}`
                  : event.daysOfWeek.length
                    ? ` · ${event.daysOfWeek.map((day) => formatWeekdayLong(day).slice(0, 3)).join(", ")}`
                    : ""}
              </p>
            </div>
            <button className="btn ghost" type="button" onClick={() => removeEvent(event.id)}>
              Remove
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
