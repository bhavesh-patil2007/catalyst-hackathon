import { NextResponse } from "next/server";
import { z } from "zod";
import { careRepository } from "@/lib/db/repository";
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
  careProfileId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createMedicationSchema.parse(body);

    // Enforce server-side role check: only owner or family_manager can manage medication plans
    const authResult = await getActorFromSessionOrHeader(
      request,
      ["owner", "family_manager"],
      validated.careProfileId
    );

    if (!authResult.success) {
      return authResult.response;
    }

    const { actor } = authResult;

    // Check patient boundary isolation
    if (validated.careProfileId && !guardianStore.verifyPatientAccess(actor.profileId, validated.careProfileId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Caregiver cannot access unrelated patient profile." },
        { status: 403 }
      );
    }

    // Persist through database repository (PostgreSQL/Supabase)
    const newMed = await careRepository.addMedicationWithVersion({
      name: validated.name,
      dosage: validated.dosage,
      instructions: validated.instructions,
      scheduleTime: validated.scheduleTime,
      slot: validated.slot,
      pillColor: validated.pillColor,
      pillShape: validated.pillShape,
      reason: validated.reason,
      authorName: actor.memberName,
    });

    return NextResponse.json({ success: true, data: newMed }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to create medication" },
      { status: 500 }
    );
  }
}

const updateMedicationSchema = z.object({
  medicationId: z.string().min(1),
  dosage: z.string().optional(),
  instructions: z.string().optional(),
  scheduleTime: z.string().optional(),
  slot: z.enum(["morning", "afternoon", "evening", "bedtime"]).optional(),
  reason: z.string().min(3),
  careProfileId: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const validated = updateMedicationSchema.parse(body);

    const authResult = await getActorFromSessionOrHeader(
      request,
      ["owner", "family_manager"],
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

    // Persist schedule edit & version history through database repository
    const result = await careRepository.editMedicationWithVersion({
      medicationId: validated.medicationId,
      dosage: validated.dosage,
      instructions: validated.instructions,
      scheduleTime: validated.scheduleTime,
      slot: validated.slot,
      reason: validated.reason,
      authorName: actor.memberName,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Medication not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.medication,
      version: result.version,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to update medication schedule" },
      { status: 500 }
    );
  }
}
