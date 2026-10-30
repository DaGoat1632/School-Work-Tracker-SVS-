"use client";

import { useMemo, useState } from "react";
import { ScheduleDayDetail } from "@/components/ScheduleDayDetail";
import { ScheduleRangeNav } from "@/components/ScheduleRangeNav";
import { activityChipsForDay, monthGridDays } from "@/lib/overview";
import { useStore } from "@/lib/store";
import { addMonths, startOfMonth, toISODate } from "@/lib/time";

export function MonthBoard() {
  const { state } = useStore();
  const now = new Date();
  const [cursor, setCursor] = useState(() => startOfMonth(now));
  const [selectedKey, setSelectedKey] = useState(toISODate(now));
  const todayKey = toISODate(now);
  const monthStart = startOfMonth(cursor);
  const grid = useMemo(() => monthGridDays(monthStart), [monthStart]);
  const selected = grid.find((day) => toISODate(day) === selectedKey) ?? monthStart;
  const inMonth = selected.getMonth() === monthStart.getMonth();
  const day = inMonth ? selected : monthStart;
  const monthLabel = monthStart.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <ScheduleRangeNav />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg">{monthLabel}</p>
        <div className="flex gap-2">
          <button type="button" className="btn secondary" onClick={() => setCursor(addMonths(monthStart, -1))}>
            Previous
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              const thisMonth = startOfMonth(new Date());
              setCursor(thisMonth);
              setSelectedKey(toISODate(new Date()));
            }}
          >
            Today
          </button>
          <button type="button" className="btn secondary" onClick={() => setCursor(addMonths(monthStart, 1))}>
            Next
          </button>
        </div>
      </div>

      <div className="month-weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <p key={label}>{label}</p>
        ))}
      </div>
      <section className="month-grid">
        {grid.map((cell) => {
          const key = toISODate(cell);
          const outside = cell.getMonth() !== monthStart.getMonth();
          const chips = outside ? [] : activityChipsForDay(state, cell).slice(0, 3);
          const extra = outside ? 0 : Math.max(0, activityChipsForDay(state, cell).length - 3);
          return (
            <button
              key={key}
              type="button"
              className={`month-cell ${outside ? "out" : ""} ${key === todayKey ? "today" : ""} ${key === selectedKey ? "selected" : ""}`}
              onClick={() => {
                setSelectedKey(key);
                if (outside) setCursor(startOfMonth(cell));
              }}
            >
              <p className="month-num">{cell.getDate()}</p>
              <ul className="month-chips">
                {chips.map((chip) => (
                  <li key={chip.id} className={`month-chip ${chip.tone}`}>
                    {chip.label}
                  </li>
                ))}
                {extra > 0 && <li className="month-chip more">+{extra} more</li>}
              </ul>
            </button>
          );
        })}
      </section>

      <ScheduleDayDetail day={day} now={now} />
    </div>
  );
}
