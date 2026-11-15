import { NextResponse } from "next/server";
import { careRepository } from "@/lib/db/repository";
import { TaskOutcome } from "@/types";
import { z } from "zod";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";
import { guardianStore } from "@/lib/store";

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

export async function GET(request: Request) {
  try {
    const authResult = await getActorFromSessionOrHeader(request, [
      "caregiver",
      "family_manager",
      "owner",
      "read_only",
    ]);

    if (!authResult.success) {
      return authResult.response;
    }

    const { actor } = authResult;
    const tasks = await careRepository.getTasks(actor.profileId);
    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Failed to query tasks" }, { status: 500 });
  }
}

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

    // 1. CLAIM ACTION
    if (body.action === "claim") {
      const { taskId } = claimSchema.parse(body);
      const claimer = actor.memberName;

      const task = await careRepository.claimTask(taskId, claimer);
      if (!task) {
        // Distinguish Not Found from Already Claimed/Resolved
        const allTasks = await careRepository.getTasks(actor.profileId);
        const existingTask = allTasks.find((t) => t.id === taskId);
        if (!existingTask) {
          return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
        }
        return NextResponse.json(
          {
            success: false,
            error: "Conflict: Task has already been claimed or resolved by another caregiver.",
            currentStatus: existingTask.status,
            claimedBy: existingTask.claimedBy,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, data: task });
    }

    // 2. HANDOFF ACTION
    if (body.action === "handoff") {
      const { taskId, toCaregiver, note } = handoffSchema.parse(body);
      const assignor = actor.memberName;
      const task = await careRepository.handoffTask(taskId, assignor, toCaregiver, note);
      if (!task) {
        const allTasks = await careRepository.getTasks(actor.profileId);
        const existingTask = allTasks.find((t) => t.id === taskId);
        if (!existingTask) {
          return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
        }
        return NextResponse.json(
          {
            success: false,
            error: "Conflict: Task is already resolved and cannot be handed off.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, data: task });
    }

    // 3. RESOLVE ACTION
    if (body.action === "resolve") {
      const { taskId, outcome, note } = resolveSchema.parse(body);
      const resolver = actor.memberName;
      const task = await careRepository.resolveTask(taskId, outcome as TaskOutcome, note, resolver);
      if (!task) {
        const allTasks = await careRepository.getTasks(actor.profileId);
        const existingTask = allTasks.find((t) => t.id === taskId);
        if (!existingTask) {
          return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
        }
        return NextResponse.json(
          {
            success: false,
            error: "Conflict: Task is already resolved.",
            resolvedAt: existingTask.resolvedAt,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, data: task });
    }

    // 4. BACKUP REQUEST ACTION
    if (body.action === "backup_request" || body.type === "BACKUP_REQUEST") {
      const parsed = backupSchema.safeParse(body);
      const reason =
        (parsed.success && parsed.data.reason) ||
        "Caregiver wellbeing trend indicates elevated fatigue & workload";
      const caregiverName = actor.memberName;

      // Check existing open/claimed backup requests to prevent duplicates
      const existingTasks = await careRepository.getTasks(actor.profileId);
      const openBackup = existingTasks.find(
        (t) =>
          (t.sourceOccurrenceId === "backup-caregiver" ||
            t.medicationName === "Caregiver Relief Coverage") &&
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

      try {
        const task = await careRepository.createBackupRequest({
          careProfileId: actor.profileId,
          caregiverName,
          reason,
        });
        return NextResponse.json({ success: true, data: task });
      } catch (insertErr: any) {
        if (insertErr?.code === "23505") {
          return NextResponse.json(
            {
              success: false,
              error: "An active relief coverage request is already pending review in CareLoop.",
            },
            { status: 409 }
          );
        }
        throw insertErr;
      }
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
