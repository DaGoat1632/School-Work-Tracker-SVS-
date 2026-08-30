"use client";

import { SchedulePage } from "@/components/SchedulePage";
import { thisWeekColumns } from "@/lib/plan";
import { useStore } from "@/lib/store";
import { addDays, startOfWeek } from "@/lib/time";

export default function ThisWeekSchedulePage() {
  const { state } = useStore();
  const weekStart = startOfWeek(new Date());
  const columns = thisWeekColumns(state);
  const rangeLabel = `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <SchedulePage
      title="This week"
      blurb="Monday through Sunday — activities, sports, and planned work."
      rangeLabel={rangeLabel}
      columns={columns}
      layout="week"
    />
  );
}
