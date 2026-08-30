"use client";

import { FormEvent, useState } from "react";
import { EVENT_CATEGORIES } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { formatWeekdayLong } from "@/lib/time";
import type { EventCategory } from "@/lib/types";

const DAYS = [1, 2, 3, 4, 5, 6, 0];

export function EventForm({
  heading = "Add a life block",
  blurb = "Fixed time that work must plan around.",
  defaultCategory = "sports",
  lockedCategory,
  titlePlaceholder = "Soccer, robotics, shift, family dinner...",
}: {
  heading?: string;
  blurb?: string;
  defaultCategory?: EventCategory;
  lockedCategory?: EventCategory;
  titlePlaceholder?: string;
}) {
  const addEvent = useStore().addEvent;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>(
    lockedCategory ?? defaultCategory,
  );
  const [startTime, setStartTime] = useState("16:30");
  const [endTime, setEndTime] = useState("18:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([2, 4]);
  const [specificDate, setSpecificDate] = useState("");
  const [travelMinutesBefore, setTravelMinutesBefore] = useState(15);
  const [travelMinutesAfter, setTravelMinutesAfter] = useState(15);
  const [saved, setSaved] = useState(false);

  function toggleDay(day: number) {
    setDaysOfWeek((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    addEvent({
      title: title.trim(),
      category: lockedCategory ?? category,
      startTime,
      endTime,
      daysOfWeek: specificDate ? [] : daysOfWeek,
      specificDate: specificDate || undefined,
      travelMinutesBefore,
      travelMinutesAfter,
    });
    setTitle("");
    setSaved(true);
  }

  return (
    <form className="card p-5" onSubmit={onSubmit}>
      <h2 className="text-2xl">{heading}</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--ink-soft)]">{blurb}</p>
      <div className="grid-form">
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={titlePlaceholder}
            required
          />
        </label>
        {!lockedCategory && (
          <label className="field">
            Category
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as EventCategory)
              }
            >
              {EVENT_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          One-off date
          <input
            type="date"
            value={specificDate}
            onChange={(event) => setSpecificDate(event.target.value)}
          />
        </label>
        <label className="field">
          Starts
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </label>
        <label className="field">
          Ends
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            required
          />
        </label>
        <label className="field">
          Travel before (min)
          <input
            type="number"
            min={0}
            value={travelMinutesBefore}
            onChange={(event) =>
              setTravelMinutesBefore(Number(event.target.value))
            }
          />
        </label>
        <label className="field">
          Travel after (min)
          <input
            type="number"
            min={0}
            value={travelMinutesAfter}
            onChange={(event) =>
              setTravelMinutesAfter(Number(event.target.value))
            }
          />
        </label>
      </div>
      {!specificDate && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-[var(--ink-soft)]">Repeats on</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const active = daysOfWeek.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    active
                      ? "bg-[var(--ink)] text-[#f7efe3]"
                      : "border border-[var(--line)]"
                  }`}
                >
                  {formatWeekdayLong(day).slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn" type="submit">
          Save
        </button>
        {saved && (
          <p className="text-sm" style={{ color: "var(--ok)" }}>
            Saved. Keep adding, then generate your plan on Weekly.
          </p>
        )}
      </div>
    </form>
  );
}
