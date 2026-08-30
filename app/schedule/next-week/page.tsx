"use client";

import { SchedulePage } from "@/components/SchedulePage";
import { nextWeekColumns } from "@/lib/plan";
import { useStore } from "@/lib/store";
import { addDays, startOfWeek } from "@/lib/time";

export default function NextWeekSchedulePage() {
  const { state } = useStore();
  const weekStart = addDays(startOfWeek(new Date()), 7);
  const columns = nextWeekColumns(state);
  const rangeLabel = `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <SchedulePage
      title="Next week"
      blurb="The following Monday–Sunday — activities, sports, and planned work."
      rangeLabel={rangeLabel}
      columns={columns}
      layout="week"
    />
  );
}
