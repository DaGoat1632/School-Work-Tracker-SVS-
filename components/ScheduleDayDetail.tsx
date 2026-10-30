"use client";

import { formatClock, formatClockRange, formatDuration, toTimeInput } from "@/lib/format";
import {
  compactBlocksForDay,
  dayHasConflict,
  freeMinutesLabel,
  homeworkConflictForDay,
  hoursNice,
  hoursPhrase,
  isOpenCalendarDay,
} from "@/lib/overview";
import { detectAllTimeConflicts, getCoachDayPlan } from "@/lib/planning";
import { useStore } from "@/lib/store";
import { formatWeekdayLong, startOfDay, toISODate } from "@/lib/time";

function timeLabel(startMin: number): string {
  return formatClock(toTimeInput(startMin));
}

export function ScheduleDayDetail({ day, now = new Date() }: { day: Date; now?: Date }) {
  const { state } = useStore();
  const conflict = dayHasConflict(state, day, now);
  const coach = getCoachDayPlan(state, day, startOfDay(day));
  const open = isOpenCalendarDay(state, day);
  const blocks = open ? [] : compactBlocksForDay(state, day, now);
  const homeworkHit = homeworkConflictForDay(state, day, now);
  const dateKey = toISODate(day);
  const timeHits = detectAllTimeConflicts(state, now).filter((hit) => hit.dateKey === dateKey);

  return (
    <article className={`card overflow-hidden ${conflict ? "day-alert" : ""}`}>
      <div className="day-card-head">
        <p className="day-title">
          {formatWeekdayLong(day.getDay())}{" "}
          {day.toLocaleDateString([], { month: "short", day: "numeric" })}
        </p>
        <p className="free-mins">{freeMinutesLabel(coach.freeMinutes)}</p>
      </div>
      {timeHits.map((hit) => (
        <p key={`${hit.left.id}-${hit.right.id}`} className="conflict-note">
          ⚠ {hit.left.title} overlaps {hit.right.title} (
          {formatClockRange(hit.left.startMin, hit.left.endMin)} and{" "}
          {formatClockRange(hit.right.startMin, hit.right.endMin)},{" "}
          {formatDuration(hit.overlapMinutes)} overlap)
        </p>
      ))}
      {homeworkHit && (
        <p className="conflict-note">
          ⚠ {homeworkHit.name} needs {hoursNice(homeworkHit.needed)} — not enough free time
          before it's due
        </p>
      )}
      {open ? (
        <div className="open-day">
          <p>No school or activities. A good day to get ahead.</p>
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
}
