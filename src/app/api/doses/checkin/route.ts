import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";

const checkInSchema = z.object({
  occurrenceId: z.string().min(1),
  status: z.enum([
    "MARKED_TAKEN",
    "SNOOZED",
    "SKIPPED",
    "NEEDS_HELP",
    "PENDING",
  ]),
  actorName: z.string().min(1),
  actorRole: z.enum(["owner", "family_manager", "caregiver", "read_only"]),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = checkInSchema.parse(body);

    // Negative authorization check: read_only cannot mutate dose events
    if (validated.actorRole === "read_only") {
      return NextResponse.json(
        { success: false, error: "Read-only members cannot record check-ins" },
        { status: 403 }
      );
    }

    const updated = guardianStore.recordCheckIn(
      validated.occurrenceId,
      validated.status,
      validated.actorName,
      validated.actorRole,
      validated.note
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Dose occurrence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
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
