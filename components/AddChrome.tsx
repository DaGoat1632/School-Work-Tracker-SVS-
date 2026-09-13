"use client";

import Link from "next/link";

export function AddChrome({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-4xl">{title}</h1>
        <p className="mt-2 text-[var(--ink-soft)]">{blurb}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/add/work" className="btn work">
          + Add work
        </Link>
        <Link href="/add/extracurricular" className="btn secondary">
          + Extracurricular
        </Link>
        <Link href="/add/sports" className="btn secondary">
          + Sports
        </Link>
        <Link href="/add/other" className="btn secondary">
          + Other
        </Link>
        <Link href="/schedule/today" className="btn ghost">
          Back to Today
        </Link>
        <Link href="/" className="btn ghost">
          Home
        </Link>
      </div>
    </header>
  );
}
