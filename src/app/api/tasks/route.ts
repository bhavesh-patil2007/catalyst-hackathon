import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";

const claimSchema = z.object({
  action: z.literal("claim"),
  taskId: z.string().min(1),
  caregiverName: z.string().min(1),
  actorRole: z.enum(["caregiver", "family_manager", "owner", "read_only"]),
});

const handoffSchema = z.object({
  action: z.literal("handoff"),
  taskId: z.string().min(1),
  fromCaregiver: z.string().min(1),
  toCaregiver: z.string().min(1),
  note: z.string().min(1),
  actorRole: z.enum(["caregiver", "family_manager", "owner", "read_only"]),
});

const resolveSchema = z.object({
  action: z.literal("resolve"),
  taskId: z.string().min(1),
  outcome: z.enum([
    "spoke_with_elder",
    "visited_in_person",
    "self_resolved",
    "unable_to_reach",
    "handed_off",
  ]),
  note: z.string().min(1),
  actorName: z.string().min(1),
  actorRole: z.enum(["caregiver", "family_manager", "owner", "read_only"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "claim") {
      const { taskId, caregiverName, actorRole } = claimSchema.parse(body);
      if (actorRole === "read_only") {
        return NextResponse.json(
          { success: false, error: "Read-only members cannot claim care tasks" },
          { status: 403 }
        );
      }
      const task = guardianStore.claimTask(taskId, caregiverName);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    if (body.action === "handoff") {
      const { taskId, fromCaregiver, toCaregiver, note, actorRole } = handoffSchema.parse(body);
      if (actorRole === "read_only") {
        return NextResponse.json(
          { success: false, error: "Read-only members cannot hand off care tasks" },
          { status: 403 }
        );
      }
      const task = guardianStore.handoffTask(taskId, fromCaregiver, toCaregiver, note);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    if (body.action === "resolve") {
      const { taskId, outcome, note, actorName, actorRole } = resolveSchema.parse(body);
      if (actorRole === "read_only") {
        return NextResponse.json(
          { success: false, error: "Read-only members cannot resolve care tasks" },
          { status: 403 }
        );
      }
      const task = guardianStore.resolveTask(taskId, outcome, note, actorName);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
