"use client";

import { useMemo, useState } from "react";
import { ScheduleRangeNav } from "@/components/ScheduleRangeNav";
import { formatClock, toTimeInput } from "@/lib/format";
import {
  activityChipsForDay,
  compactBlocksForDay,
  dayHasConflict,
  freeMinutesLabel,
  hoursPhrase,
  isOpenCalendarDay,
  monthGridDays,
} from "@/lib/overview";
import { getCoachDayPlan } from "@/lib/planning";
import { useStore } from "@/lib/store";
import {
  addMonths,
  formatWeekdayLong,
  startOfDay,
  startOfMonth,
  toISODate,
} from "@/lib/time";

function timeLabel(startMin: number): string {
  return formatClock(toTimeInput(startMin));
}

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
  const conflict = dayHasConflict(state, day, now);
  const coach = getCoachDayPlan(state, day, startOfDay(day));
  const open = isOpenCalendarDay(state, day);
  const blocks = open ? [] : compactBlocksForDay(state, day, now);
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
        {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((label) => (
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

      <article className={`card overflow-hidden ${conflict ? "day-alert" : ""}`}>
        <div className={`day-card-head ${conflict ? "conflict" : ""}`}>
          <p className="day-title">
            {formatWeekdayLong(day.getDay())} {day.toLocaleDateString([], { month: "short", day: "numeric" })}
          </p>
          <p className="free-mins">{freeMinutesLabel(coach.freeMinutes)}</p>
        </div>
        {open ? (
          <div className="open-day">
            <p>No school or activities today.</p>
            <p>Great day to get ahead on work.</p>
          </div>
        ) : (
          <ul className="pb-3">
            {blocks.map((block) => (
              <li key={block.id} className="week-block">
                <span className="week-time">
                  {block.study
                    ? `${timeLabel(block.startMin)} – ${timeLabel(block.endMin)}`
                    : timeLabel(block.startMin)}
                </span>
                <span className={`bar ${block.tone}`} />
                <div>
                  <p className="week-name">{block.title}</p>
                  <p className="week-detail">
                    {block.study
                      ? block.detail
                      : (block.detail ??
                        (block.tone === "free" ? hoursPhrase(block.minutes) : `until ${timeLabel(block.endMin)}`))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
