import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { careRepository } from "@/lib/db/repository";
import { calculateWellbeingRisk } from "@/lib/wellbeingStore";
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
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const parsed = CheckInSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 2. Derive caregiver identity STRICTLY from the verified session (prefer stable memberId, fallback to memberName)
    const verifiedCaregiverId = actor.memberId || actor.memberName;

    try {
      // 3. Persist through database repository with atomic daily constraint
      const checkIn = await careRepository.addWellbeingCheckIn({
        ...parsed.data,
        careProfileId: actor.profileId,
        caregiverId: verifiedCaregiverId,
      });

      // Calculate risk and trends from persistent database records
      const history = await careRepository.getWellbeingHistory(verifiedCaregiverId, actor.profileId);
      const riskAssessment = calculateWellbeingRisk(history);

      return NextResponse.json(
        {
          success: true,
          checkIn,
          burnoutRisk: riskAssessment.level,
          assessment: riskAssessment,
        },
        { status: 201 }
      );
    } catch (err: any) {
      if (err?.code === "DUPLICATE_DAILY_CHECKIN" || err?.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            error: "Daily check-in already recorded for today in this care circle.",
          },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err: any) {
    console.error("[wellbeing/checkin] Error:", err?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
