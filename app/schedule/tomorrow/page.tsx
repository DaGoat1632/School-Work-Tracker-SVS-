"use client";

import { SchedulePage } from "@/components/SchedulePage";
import { tomorrowColumn } from "@/lib/plan";
import { useStore } from "@/lib/store";

export default function TomorrowSchedulePage() {
  const { state } = useStore();
  const columns = tomorrowColumn(state);
  const day = columns[0]?.day ?? new Date();

  return (
    <SchedulePage
      title="Tomorrow"
      blurb="Tomorrow’s activities and any homework already placed."
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
