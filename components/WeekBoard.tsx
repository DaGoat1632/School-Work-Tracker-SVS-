"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ScheduleDayDetail } from "@/components/ScheduleDayDetail";
import { ScheduleRangeNav } from "@/components/ScheduleRangeNav";
import { dayDot, dayHasConflict, weekDays } from "@/lib/overview";
import { useStore } from "@/lib/store";
import {
  addDays,
  formatWeekdayLong,
  parseISODate,
  startOfWeek,
  toISODate,
  weekOffsetFrom,
  weekRangeLabel,
  weekTitle,
} from "@/lib/time";

function weekHref(pathname: string, week: number, dayKey: string) {
  return `${pathname}?week=${week}&day=${dayKey}`;
}

export function WeekBoard() {
  const { state } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = new Date();
  const todayKey = toISODate(now);
  const thisMonday = startOfWeek(now);

  const dayFromUrl = parseISODate(params.get("day"));
  const weekParam = Number.parseInt(params.get("week") ?? "", 10);
  const monday = dayFromUrl
    ? startOfWeek(dayFromUrl)
    : addDays(thisMonday, Number.isFinite(weekParam) ? weekParam * 7 : 0);
  const days = weekDays(monday);
  const week = weekOffsetFrom(monday, now);
  const mondayKey = toISODate(monday);
  const selectedKey =
    dayFromUrl && days.some((day) => toISODate(day) === toISODate(dayFromUrl))
      ? toISODate(dayFromUrl)
      : week === 0
        ? todayKey
        : mondayKey;
  const selected = days.find((day) => toISODate(day) === selectedKey) ?? days[0];

  function go(nextWeek: number, dayKey: string) {
    router.replace(weekHref(pathname, nextWeek, dayKey));
  }

  return (
    <div className="space-y-4">
      <ScheduleRangeNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg">{weekTitle(monday, now)}</p>
          <p className="text-sm text-[var(--ink-soft)]">{weekRangeLabel(monday)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn ${week === -1 ? "work" : "secondary"}`}
            aria-pressed={week === -1}
            onClick={() => go(-1, toISODate(addDays(thisMonday, -7)))}
          >
            Previous week
          </button>
          <button
            type="button"
            className={`btn ${week === 0 ? "work" : "secondary"}`}
            aria-pressed={week === 0}
            onClick={() => go(0, todayKey)}
          >
            This week
          </button>
          <button
            type="button"
            className={`btn ${week === 1 ? "work" : "secondary"}`}
            aria-pressed={week === 1}
            onClick={() => go(1, toISODate(addDays(thisMonday, 7)))}
          >
            Next week
          </button>
        </div>
      </div>

      <section className="week-strip" aria-label={weekTitle(monday, now)}>
        {days.map((day) => {
          const key = toISODate(day);
          const dot = dayDot(state, day, now);
          const dayConflict = dayHasConflict(state, day, now);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          const isPast = key < todayKey;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${formatWeekdayLong(day.getDay())} ${day.getDate()}`}
              className={`week-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${isPast ? "past" : ""} ${dayConflict ? "conflict" : ""}`}
              onClick={() => go(week, key)}
            >
              <p className="dow">{formatWeekdayLong(day.getDay()).slice(0, 3)}</p>
              <p className="num">{day.getDate()}</p>
              <div className={`week-dot ${dot}`} />
            </button>
          );
        })}
      </section>

      <ScheduleDayDetail day={selected} now={now} />
    </div>
  );
}
