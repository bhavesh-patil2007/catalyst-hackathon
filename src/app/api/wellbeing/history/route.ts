import { NextRequest, NextResponse } from "next/server";
import { getHistory, getBurnoutRisk } from "@/lib/wellbeingStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const caregiverId = searchParams.get("caregiverId");

  if (!caregiverId) {
    return NextResponse.json(
      { error: "caregiverId query parameter is required" },
      { status: 400 }
    );
  }

  const history = getHistory(caregiverId);
  const burnoutRisk = getBurnoutRisk(caregiverId);

  return NextResponse.json({ history, burnoutRisk }, { status: 200 });
}
