import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const createMedicationSchema = z.object({
  name: z.string().min(2),
  dosage: z.string().min(1),
  instructions: z.string().min(3),
  scheduleTime: z.string().min(1),
  slot: z.enum(["morning", "afternoon", "evening", "bedtime"]),
  pillColor: z.string().default("emerald"),
  pillShape: z.enum(["round", "capsule", "oval", "liquid"]).default("capsule"),
  reason: z.string().min(2),
  authorName: z.string().optional(),
  careProfileId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createMedicationSchema.parse(body);

    // Enforce server-side role check: only owner or family_manager can manage medication plans
    // Caregivers and read_only users are forbidden from creating baseline schedules
    const authResult = await getActorFromSessionOrHeader(
      request,
      ["owner", "family_manager"],
      validated.careProfileId
    );

    if (!authResult.success) {
      return authResult.response;
    }

    const { actor } = authResult;

    // Check patient isolation if careProfileId is provided
    if (validated.careProfileId && !guardianStore.verifyPatientAccess(actor.profileId, validated.careProfileId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Caregiver cannot access unrelated patient profile." },
        { status: 403 }
      );
    }

    const newMed = guardianStore.addMedicationWithVersion({
      name: validated.name,
      dosage: validated.dosage,
      instructions: validated.instructions,
      scheduleTime: validated.scheduleTime,
      slot: validated.slot,
      pillColor: validated.pillColor,
      pillShape: validated.pillShape,
      reason: validated.reason,
      authorName: validated.authorName || actor.memberName,
    });

    return NextResponse.json({ success: true, data: newMed }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to create medication" },
      { status: 500 }
    );
  }
}
