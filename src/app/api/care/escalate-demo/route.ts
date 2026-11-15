import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";

const escalateSchema = z.object({
  occurrenceId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const validated = escalateSchema.parse(body);

    const occurrences = guardianStore.getOccurrences();
    // Default to a pending occurrence if not specified
    const targetOcc =
      (validated.occurrenceId && occurrences.find((o) => o.id === validated.occurrenceId)) ||
      occurrences.find((o) => o.status === "PENDING" || o.status === "SCHEDULED") ||
      occurrences[0];

    if (!targetOcc) {
      return NextResponse.json(
        { success: false, error: "No eligible dose occurrence found" },
        { status: 404 }
      );
    }

    const task = guardianStore.escalateUnconfirmedDose(targetOcc.id);

    return NextResponse.json({
      success: true,
      message: "CareLoop escalation simulated successfully",
      data: {
        task,
        targetOccurrence: targetOcc,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to simulate escalation" },
      { status: 500 }
    );
  }
}
