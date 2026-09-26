"use client";

import { EventForm } from "@/components/EventForm";

export default function AddExtracurricularPage() {
  return (
    <EventForm
      heading="Club"
      blurb="These stay fixed. Homework plans around them."
      lockedCategory="club"
      titlePlaceholder="Robotics, band, debate..."
    />
  );
}
