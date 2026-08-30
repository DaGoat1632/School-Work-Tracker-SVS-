"use client";

import { AddChrome } from "@/components/AddChrome";
import { EventForm } from "@/components/EventForm";

export default function AddOtherPage() {
  return (
    <main>
      <AddChrome
        title="School, job, family & more"
        blurb="School hours, shifts, family plans, commute, or anything else."
      />
      <EventForm
        heading="Add another life block"
        blurb="Pick a category, set the time, and include travel if you drive."
        defaultCategory="school"
        titlePlaceholder="School, job shift, family dinner, commute..."
      />
    </main>
  );
}
