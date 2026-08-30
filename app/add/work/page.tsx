"use client";

import { AddChrome } from "@/components/AddChrome";
import { TaskForm } from "@/components/TaskForm";

export default function AddWorkPage() {
  return (
    <main>
      <AddChrome
        title="Add work"
        blurb="Homework, projects, quizzes, and tests."
      />
      <TaskForm />
    </main>
  );
}
