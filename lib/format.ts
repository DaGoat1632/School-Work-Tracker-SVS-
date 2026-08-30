function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "3:30 PM" from "15:30" or Date */
export function formatClock(
  input: string | Date,
): string {
  if (typeof input === "string" && input.includes(":")) {
    const [h, m] = input.split(":").map(Number);
    const date = new Date();
    date.setHours(h || 0, m || 0, 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return new Date(input).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? "1 hr" : `${hours} hrs`;
  return `${hours}h ${rest}m`;
}

export function minutesOf(input: string | Date): number {
  if (typeof input === "string" && /^\d{1,2}:\d{2}$/.test(input)) {
    const [h, m] = input.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  const date = new Date(input);
  return date.getHours() * 60 + date.getMinutes();
}

export function hourLabel(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric" });
}

export function toTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad(h)}:${pad(m)}`;
}
