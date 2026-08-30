"use client";

import { AddChrome } from "@/components/AddChrome";
import { EventForm } from "@/components/EventForm";

export default function AddExtracurricularPage() {
  return (
    <main>
      <AddChrome
        title="Add extracurricular"
        blurb="Clubs, music, tutoring, volunteering."
      />
      <EventForm
        heading="Extracurricular"
        blurb="These stay fixed. The scheduler plans homework around them."
        lockedCategory="club"
        titlePlaceholder="Robotics, band, debate, volunteering..."
      />
    </main>
  );
}
