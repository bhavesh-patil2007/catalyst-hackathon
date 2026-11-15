import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addCheckIn, getBurnoutRisk } from "@/lib/wellbeingStore";

const CheckInSchema = z.object({
  caregiverId: z.string().min(1),
  sleepHours: z.number().min(0).max(12),
  mood: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  stress: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  energy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  note: z.string().max(500).optional(),
  shareWithFamily: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CheckInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const checkIn = addCheckIn(parsed.data);
    const burnoutRisk = getBurnoutRisk(parsed.data.caregiverId);

    return NextResponse.json({ success: true, checkIn, burnoutRisk }, { status: 201 });
  } catch (err) {
    console.error("[wellbeing/checkin] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
