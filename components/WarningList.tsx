"use client";

import { useStore } from "@/lib/store";

export function WarningList() {
  const warnings = useStore().state.warnings;
  if (warnings.length === 0) return null;

  return (
    <section className="card mb-6 p-4 md:p-5">
      <h2 className="text-xl">Schedule pressure</h2>
      <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
        {warnings.map((warning, index) => (
          <li key={`${warning.taskId}-${index}`} className="flex gap-2">
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{
                background:
                  warning.type === "overload" || warning.type === "past_due"
                    ? "var(--warn)"
                    : "var(--job)",
              }}
            />
            <span>{warning.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
