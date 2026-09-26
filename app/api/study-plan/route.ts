import { NextResponse } from "next/server";
import { buildPlanningPrompt, parseAiStudyPlan } from "@/lib/aiStudyPlan";
import { dueIsSoon, isExamTask, type FreeWindow } from "@/lib/freeWindows";
import { buildLocalStudyPlan, windowsForTask } from "@/lib/placeStudyPlan";
import type { FixedEvent, StudySession } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  task: {
    title: string;
    subject?: string;
    className?: string;
    type: string;
    dueAt: string;
    hoursNeeded?: number;
    estimatedMinutes?: number;
    difficulty?: string;
    priority?: string;
    canSplit?: boolean;
  };
  events: FixedEvent[];
  studySessions?: Pick<StudySession, "dateKey" | "startMin" | "endMin" | "taskId">[];
  now?: string;
  excludeTaskId?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const now = body.now ? new Date(body.now) : new Date();
  const dueAt = body.task.dueAt;
  const exam = isExamTask({ type: body.task.type, title: body.task.title });
  const hoursNeeded =
    body.task.hoursNeeded ??
    (body.task.estimatedMinutes ? body.task.estimatedMinutes / 60 : exam ? 2 : 1);
  const dueDate = new Date(dueAt).toLocaleString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const windows = windowsForTask({
    task: {
      id: body.excludeTaskId || "new",
      title: body.task.title,
      type: body.task.type,
      dueAt,
    },
    events: body.events ?? [],
    studySessions: body.studySessions ?? [],
    now,
  });

  if (windows.length === 0) {
    return NextResponse.json({
      ok: true,
      noWindows: true,
      windows: [] as FreeWindow[],
      message:
        "No free time found before this deadline. Try rescheduling an activity or asking your teacher for more time.",
    });
  }

  const emergency = dueIsSoon(dueAt, now);
  const usedWindows = emergency ? [windows[0]] : windows;

  const localPlan = buildLocalStudyPlan(
    {
      title: body.task.title,
      className: body.task.subject || body.task.className || "",
      type: body.task.type,
      dueAt,
      estimatedMinutes: body.task.estimatedMinutes || hoursNeeded * 60,
    },
    usedWindows,
  );

  const key = process.env.ANTHROPIC_API_KEY || process.env.API_KEY;
  if (!key) {
    return NextResponse.json({
      ok: true,
      plan: localPlan,
      windows: usedWindows,
      emergency,
      onlyWindow: emergency ? usedWindows[0] : undefined,
    });
  }

  const prompt = buildPlanningPrompt(
    {
      title: body.task.title,
      subject: body.task.subject || body.task.className || "General",
      type: exam ? "test" : body.task.type,
      dueDate,
      dueAt,
      hoursNeeded,
      difficulty: body.task.difficulty,
      priority: body.task.priority,
      canSplit: body.task.canSplit,
    },
    usedWindows,
  );

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Anthropic error", response.status, detail);
      return NextResponse.json({
        ok: true,
        plan: localPlan,
        windows: usedWindows,
        emergency,
        onlyWindow: emergency ? usedWindows[0] : undefined,
      });
    }

    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = payload.content?.find((part) => part.type === "text")?.text ?? "";
    let plan;
    try {
      plan = parseAiStudyPlan(text);
      if (!plan.plan?.length) plan = localPlan;
    } catch {
      plan = localPlan;
    }

    return NextResponse.json({
      ok: true,
      plan,
      windows: usedWindows,
      emergency,
      onlyWindow: emergency ? usedWindows[0] : undefined,
      message: emergency
        ? `This is due very soon. Here is your only available study window: ${usedWindows[0].day} ${usedWindows[0].start} – ${usedWindows[0].end}`
        : undefined,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      ok: true,
      plan: localPlan,
      windows: usedWindows,
      emergency,
      onlyWindow: emergency ? usedWindows[0] : undefined,
    });
  }
}
