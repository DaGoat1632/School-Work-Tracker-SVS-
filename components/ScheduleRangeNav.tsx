"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ScheduleRangeNav() {
  const pathname = usePathname();
  return (
    <div className="pills mb-4">
      <Link href="/schedule/week" className={`pill ${pathname.startsWith("/schedule/week") ? "on" : ""}`}>
        Week
      </Link>
      <Link href="/schedule/month" className={`pill ${pathname.startsWith("/schedule/month") ? "on" : ""}`}>
        Month
      </Link>
    </div>
  );
}
