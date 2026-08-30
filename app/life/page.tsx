"use client";

import { EventForm } from "@/components/EventForm";
import { EVENT_CATEGORIES } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { formatWeekdayLong } from "@/lib/time";

export default function LifePage() {
  const { state, removeEvent } = useStore();

  return (
    <main className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <EventForm />
      <section className="space-y-3">
        {state.events.map((event) => (
          <article key={event.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="chip">
                  {EVENT_CATEGORIES.find((item) => item.value === event.category)?.label}
                </p>
                <h3 className="mt-2 text-2xl">{event.title}</h3>
                <p className="text-sm text-[var(--ink-soft)]">
                  {event.startTime}–{event.endTime}
                  {event.specificDate
                    ? ` on ${event.specificDate}`
                    : ` · ${event.daysOfWeek.map(formatWeekdayLong).join(", ")}`}
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  Travel {event.travelMinutesBefore}m before, {event.travelMinutesAfter}m after
                </p>
              </div>
              <button className="btn ghost" onClick={() => removeEvent(event.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
