import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";

const createMedicationSchema = z.object({
  name: z.string().min(2),
  dosage: z.string().min(1),
  instructions: z.string().min(3),
  scheduleTime: z.string().min(1),
  slot: z.enum(["morning", "afternoon", "evening", "bedtime"]),
  pillColor: z.string().default("emerald"),
  pillShape: z.enum(["round", "capsule", "oval", "liquid"]).default("capsule"),
  reason: z.string().min(2),
  authorName: z.string().min(2),
  actorRole: z.enum(["owner", "family_manager", "caregiver", "read_only"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createMedicationSchema.parse(body);

    if (validated.actorRole === "read_only") {
      return NextResponse.json(
        { success: false, error: "Read-only members cannot create medication plans" },
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
      authorName: validated.authorName,
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
