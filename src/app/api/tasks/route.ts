import { NextResponse } from "next/server";
import { z } from "zod";
import { careRepository, TaskOutcome } from "@/lib/db/repository";
import { guardianStore } from "@/lib/store";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const claimSchema = z.object({
  action: z.literal("claim"),
  taskId: z.string().min(1),
  careProfileId: z.string().optional(),
});

const handoffSchema = z.object({
  action: z.literal("handoff"),
  taskId: z.string().min(1),
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
  careProfileId: z.string().optional(),
});

const backupSchema = z.object({
  action: z.literal("backup_request"),
  reason: z.string().min(1).optional(),
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
      const { taskId } = claimSchema.parse(body);
      const claimer = actor.memberName;
      const task = await careRepository.claimTask(taskId, claimer);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    if (body.action === "handoff") {
      const { taskId, toCaregiver, note } = handoffSchema.parse(body);
      const assignor = actor.memberName;
      const task = await careRepository.handoffTask(taskId, assignor, toCaregiver, note);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    if (body.action === "resolve") {
      const { taskId, outcome, note } = resolveSchema.parse(body);
      const resolver = actor.memberName;
      const task = await careRepository.resolveTask(taskId, outcome as TaskOutcome, note, resolver);
      if (!task) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    if (body.action === "backup_request" || body.type === "BACKUP_REQUEST") {
      const parsed = backupSchema.safeParse(body);
      const reason = (parsed.success && parsed.data.reason) || "Caregiver wellbeing trend indicates elevated fatigue & workload";
      const caregiverName = actor.memberName;

      // Check existing open/claimed backup requests to prevent duplicates
      const existingTasks = await careRepository.getTasks(actor.profileId);
      const openBackup = existingTasks.find(
        (t) =>
          (t.sourceOccurrenceId === "backup-caregiver" || t.medicationName === "Caregiver Relief Coverage") &&
          (t.status === "OPEN" || t.status === "CLAIMED")
      );
      if (openBackup) {
        return NextResponse.json(
          {
            success: false,
            error: "An active relief coverage request is already pending review in CareLoop.",
            existingTaskId: openBackup.id,
          },
          { status: 409 }
        );
      }

      const task = await careRepository.createBackupRequest({
        caregiverName,
        reason,
      });
      return NextResponse.json({ success: true, data: task });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
