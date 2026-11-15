import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const checkInSchema = z.object({
  occurrenceId: z.string().min(1),
  status: z.enum([
    "MARKED_TAKEN",
    "SNOOZED",
    "SKIPPED",
    "NEEDS_HELP",
    "NOT_SURE",
    "PENDING",
  ]),
  note: z.string().optional(),
  doNotNotifyFamily: z.boolean().optional(),
  careProfileId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = checkInSchema.parse(body);

    // Enforce server-side authorization: read_only members cannot record check-ins
    const authResult = await getActorFromSessionOrHeader(
      request,
      ["owner", "family_manager", "caregiver"],
      validated.careProfileId
    );

    if (!authResult.success) {
      return authResult.response;
    }

    const { actor } = authResult;

    if (validated.careProfileId && !guardianStore.verifyPatientAccess(actor.profileId, validated.careProfileId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Caregiver cannot access unrelated patient profile." },
        { status: 403 }
      );
    }

    // Actor identity strictly derived from server-side verified session
    const updated = guardianStore.recordCheckIn(
      validated.occurrenceId,
      validated.status,
      actor.memberName,
      actor.role,
      validated.note,
      validated.doNotNotifyFamily
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Dose occurrence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      actor: {
        name: actor.memberName,
        role: actor.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to record dose check-in" },
      { status: 500 }
    );
  }
}
