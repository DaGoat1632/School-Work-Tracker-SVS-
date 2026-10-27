"use client";

import { useState } from "react";
import { ScheduleRangeNav } from "@/components/ScheduleRangeNav";
import { formatClock, toTimeInput } from "@/lib/format";
import {
  compactBlocksForDay,
  dayDot,
  dayHasConflict,
  freeMinutesLabel,
  homeworkConflictForDay,
  hoursNice,
  hoursPhrase,
  isOpenCalendarDay,
  weekDays,
} from "@/lib/overview";
import { getCoachDayPlan } from "@/lib/planning";
import { useStore } from "@/lib/store";
import { formatWeekdayLong, startOfDay, toISODate } from "@/lib/time";

function timeLabel(startMin: number): string {
  return formatClock(toTimeInput(startMin));
}

export function WeekBoard() {
  const { state } = useStore();
  const now = new Date();
  const days = weekDays(now);
  const todayKey = toISODate(now);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const selected = days.find((day) => toISODate(day) === selectedKey) ?? days[0];
  const conflict = dayHasConflict(state, selected, now);
  const coach = getCoachDayPlan(state, selected, startOfDay(selected));
  const free = coach.freeMinutes;
  const open = isOpenCalendarDay(state, selected);
  const blocks = open ? [] : compactBlocksForDay(state, selected, now);
  const homeworkHit = homeworkConflictForDay(state, selected, now);

  return (
    <div className="space-y-4">
      <ScheduleRangeNav />
      <section className="week-strip" aria-label="This week">
        {days.map((day) => {
          const key = toISODate(day);
          const dot = dayDot(state, day, now);
          const dayConflict = dayHasConflict(state, day, now);
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${formatWeekdayLong(day.getDay())} ${day.getDate()}`}
              className={`week-cell ${key === todayKey ? "today" : ""} ${dayConflict ? "conflict" : ""} ${isSelected ? "selected" : ""}`}
              onClick={() => setSelectedKey(key)}
            >
              <p className="dow">{formatWeekdayLong(day.getDay()).slice(0, 3)}</p>
              <p className="num">{day.getDate()}</p>
              <div className={`week-dot ${dot}`} />
            </button>
          );
        })}
      </section>

      <article className={`card overflow-hidden ${conflict ? "day-alert" : ""}`}>
        <div className={`day-card-head ${conflict ? "conflict" : ""}`}>
          <p className="day-title">
            {formatWeekdayLong(selected.getDay())}{" "}
            {selected.toLocaleDateString([], { month: "short", day: "numeric" })}
          </p>
          <p className="free-mins">
            {conflict
              ? `⚠ Conflict — only ${hoursNice(homeworkHit?.free ?? free)} free`
              : freeMinutesLabel(free)}
          </p>
        </div>
        {conflict && homeworkHit && (
          <p className="conflict-note">
            {homeworkHit.name} needs {hoursNice(homeworkHit.needed)} but you only have{" "}
            {hoursNice(homeworkHit.free)} free
          </p>
        )}
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
                  <p className="week-name">
                    {block.title}
                    {block.bestWindow && <span className="best-pill">best window</span>}
                  </p>
                  <p className="week-detail">
                    {block.study
                      ? block.detail
                      : (block.detail ??
                        (block.tone === "free"
                          ? hoursPhrase(block.minutes)
                          : `until ${timeLabel(block.endMin)}`))}
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
