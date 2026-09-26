const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

export function minutesFromMidnight(hhmm: string): number {
  const { hours, minutes } = parseTime(hhmm);
  return hours * 60 + minutes;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMinutes(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 60_000);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function combineDateAndTime(date: Date, hhmm: string): Date {
  const next = startOfDay(date);
  const { hours, minutes } = parseTime(hhmm);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function weekday(date: Date): number {
  return date.getDay();
}

export function isWeekend(date: Date): boolean {
  const day = weekday(date);
  return day === 0 || day === 6;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDayLabel(date: Date, today = new Date()): string {
  const day = startOfDay(date);
  const now = startOfDay(today);
  const diff = Math.round((day.getTime() - now.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${WEEKDAYS[weekday(date)]} ${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatWeekday(date: Date): string {
  return WEEKDAYS[weekday(date)];
}

export function formatWeekdayLong(dayIndex: number): string {
  return WEEKDAYS_LONG[dayIndex];
}

export function formatDue(iso: string): string {
  const date = new Date(iso);
  return `${formatDayLabel(date)} ${formatTime(date)}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

/** Week runs Saturday through Friday. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (weekday(day) + 1) % 7;
  return addDays(day, -offset);
}

export function startOfMonth(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(1);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

export function daysInMonth(date: Date): Date[] {
  const start = startOfMonth(date);
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getMonth() === start.getMonth()) {
    days.push(startOfDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function hoursUntil(iso: string, now = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 3_600_000;
}
