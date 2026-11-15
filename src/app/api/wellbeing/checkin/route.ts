import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addCheckIn, getBurnoutRisk } from "@/lib/wellbeingStore";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const CheckInSchema = z.object({
  sleepHours: z.number().min(0).max(12),
  mood: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  stress: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  energy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  note: z.string().max(500).optional(),
  shareWithFamily: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce authentication: strictly caregivers (or authorized managers) can submit wellbeing
    const authResult = await getActorFromSessionOrHeader(req, ["caregiver", "family_manager"]);
    if (!authResult.success) {
      return authResult.response;
    }

    const { actor } = authResult;
    const body = await req.json();
    const parsed = CheckInSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 2. Derive caregiver identity STRICTLY from the verified session
    const verifiedCaregiverId = actor.memberName;

    const checkIn = addCheckIn({
      ...parsed.data,
      caregiverId: verifiedCaregiverId,
    });

    const burnoutRisk = getBurnoutRisk(verifiedCaregiverId);

    return NextResponse.json({ success: true, checkIn, burnoutRisk }, { status: 201 });
  } catch (err) {
    console.error("[wellbeing/checkin] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
