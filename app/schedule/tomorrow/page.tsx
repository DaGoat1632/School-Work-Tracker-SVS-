import { redirect } from "next/navigation";
import { addDays, startOfDay, startOfWeek, toISODate, weekOffsetFrom } from "@/lib/time";

export default function TomorrowSchedulePage() {
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const week = weekOffsetFrom(startOfWeek(tomorrow));
  redirect(`/schedule/week?week=${week}&day=${toISODate(tomorrow)}`);
}
