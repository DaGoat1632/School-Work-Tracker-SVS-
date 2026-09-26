"use client";

import { EventForm } from "@/components/EventForm";

export default function AddOtherPage() {
  return (
    <EventForm
      heading="Class or other"
      blurb="School hours, shifts, family plans, or commute."
      defaultCategory="school"
      titlePlaceholder="School, job shift, family dinner..."
    />
  );
}
