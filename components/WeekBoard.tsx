"use client";

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

  return (
    <div className="space-y-4">
      <ScheduleRangeNav />
      <section className="week-strip">
        {days.map((day) => {
          const key = toISODate(day);
          const dot = dayDot(state, day, now);
          const conflict = dayHasConflict(state, day, now);
          return (
            <div
              key={key}
              className={`week-cell ${key === todayKey ? "today" : ""} ${conflict ? "conflict" : ""}`}
            >
              <p className="dow">{formatWeekdayLong(day.getDay()).slice(0, 3)}</p>
              <p className="num">{day.getDate()}</p>
              <div className={`week-dot ${dot}`} />
            </div>
          );
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {days.map((day) => {
          const key = toISODate(day);
          const conflict = dayHasConflict(state, day, now);
          const coach = getCoachDayPlan(state, day, startOfDay(day));
          const free = coach.freeMinutes;
          const open = isOpenCalendarDay(state, day);
          const blocks = open ? [] : compactBlocksForDay(state, day, now);
          const homeworkHit = homeworkConflictForDay(state, day, now);
          return (
            <article key={key} className={`card overflow-hidden ${conflict ? "day-alert" : ""}`}>
              <div className={`day-card-head ${conflict ? "conflict" : ""}`}>
                <p className="day-title">{formatWeekdayLong(day.getDay())}</p>
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
          );
        })}
      </section>
    </div>
  );
}
