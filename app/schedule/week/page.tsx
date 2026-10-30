import { Suspense } from "react";
import { WeekBoard } from "@/components/WeekBoard";

export default function ThisWeekSchedulePage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--ink-soft)]">Loading this week…</p>}>
      <WeekBoard />
    </Suspense>
  );
}
