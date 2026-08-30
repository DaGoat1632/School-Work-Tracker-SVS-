"use client";

import { SchedulePage } from "@/components/SchedulePage";
import { todayColumn } from "@/lib/plan";
import { useStore } from "@/lib/store";

export default function TodaySchedulePage() {
  const { state } = useStore();
  const columns = todayColumn(state);
  const day = columns[0]?.day ?? new Date();
  const name = state.preferences.studentName || "there";

  return (
    <SchedulePage
      title={`Hey ${name}`}
      blurb="Today’s activities and planned work. Add more below, then generate your plan."
      rangeLabel={day.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      columns={columns}
      layout="stack"
    />
  );
}
