"use client";

import { EventForm } from "@/components/EventForm";

export default function AddSportsPage() {
  return (
    <EventForm
      heading="Sports"
      blurb="Practice or a game. Include drive time if it matters."
      lockedCategory="sports"
      titlePlaceholder="Soccer practice, basketball game..."
    />
  );
}
