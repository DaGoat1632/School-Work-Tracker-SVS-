"use client";

import { SchedulePage } from "@/components/SchedulePage";
import { nextMonthColumns } from "@/lib/plan";
import { useStore } from "@/lib/store";
import { addMonths, startOfMonth } from "@/lib/time";

export default function NextMonthSchedulePage() {
  const { state } = useStore();
  const month = startOfMonth(addMonths(new Date(), 1));
  const columns = nextMonthColumns(state);
  const rangeLabel = month.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  return (
    <SchedulePage
      title="Next month"
      blurb="Look ahead at next month’s activities, games, and scheduled work."
      rangeLabel={rangeLabel}
      columns={columns}
      layout="month"
    />
  );
}
