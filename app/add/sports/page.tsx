"use client";

import { AddChrome } from "@/components/AddChrome";
import { EventForm } from "@/components/EventForm";

export default function AddSportsPage() {
  return (
    <main>
      <AddChrome
        title="Sports & games"
        blurb="Practices, games, and meets — include drive time."
      />
      <EventForm
        heading="Add sports or a game"
        blurb="Use a one-off date for games. Use repeating days for practice."
        lockedCategory="sports"
        titlePlaceholder="Soccer practice, basketball game, swim meet..."
      />
    </main>
  );
}
