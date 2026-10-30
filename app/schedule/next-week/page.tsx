import { redirect } from "next/navigation";
import { addDays, startOfWeek, toISODate } from "@/lib/time";

export default function NextWeekSchedulePage() {
  const monday = addDays(startOfWeek(new Date()), 7);
  redirect(`/schedule/week?week=1&day=${toISODate(monday)}`);
}
