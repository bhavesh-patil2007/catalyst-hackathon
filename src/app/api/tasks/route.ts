import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const claimSchema = z.object({
  action: z.literal("claim"),
  taskId: z.string().min(1),
  caregiverName: z.string().optional(),
  careProfileId: z.string().optional(),
});

const handoffSchema = z.object({
  action: z.literal("handoff"),
  taskId: z.string().min(1),
  fromCaregiver: z.string().optional(),
  toCaregiver: z.string().min(1),
  note: z.string().min(1),
  careProfileId: z.string().optional(),
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
  actorName: z.string().optional(),
  careProfileId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Enforce server-side authorization: read_only members cannot claim, handoff, or resolve tasks
    const authResult = await getActorFromSessionOrHeader(
      request,
      ["caregiver", "family_manager", "owner"],
      body.careProfileId
    );

    if (!authResult.success) {
      return authResult.response;
    }

    const { actor } = authResult;

    if (body.careProfileId && !guardianStore.verifyPatientAccess(actor.profileId, body.careProfileId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Caregiver cannot access unrelated patient profile." },
        { status: 403 }
      );
    }

    if (body.action === "claim") {
      const { taskId, caregiverName } = claimSchema.parse(body);
      const claimer = caregiverName || actor.memberName;
      const task = guardianStore.claimTask(taskId, claimer);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    if (body.action === "handoff") {
      const { taskId, fromCaregiver, toCaregiver, note } = handoffSchema.parse(body);
      const assignor = fromCaregiver || actor.memberName;
      const task = guardianStore.handoffTask(taskId, assignor, toCaregiver, note);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    if (body.action === "resolve") {
      const { taskId, outcome, note, actorName } = resolveSchema.parse(body);
      const resolver = actorName || actor.memberName;
      const task = guardianStore.resolveTask(taskId, outcome, note, resolver);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    if (body.action === "backup_request" || body.type === "BACKUP_REQUEST") {
      const caregiverName = body.caregiverName || actor.memberName;
      const reason = body.reason || "Caregiver wellbeing trend indicates elevated fatigue & workload";
      const task = guardianStore.createBackupRequest({
        caregiverName,
        reason,
      });
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
