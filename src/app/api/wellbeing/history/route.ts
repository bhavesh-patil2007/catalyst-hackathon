import { NextRequest, NextResponse } from "next/server";
import { careRepository } from "@/lib/db/repository";
import { getBurnoutRisk } from "@/lib/wellbeingStore";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

export async function GET(req: NextRequest) {
  // 1. Enforce authentication
  const authResult = await getActorFromSessionOrHeader(req, [
    "caregiver",
    "family_manager",
    "owner",
  ]);

  if (!authResult.success) {
    return authResult.response;
  }

  const { actor } = authResult;
  const { searchParams } = new URL(req.url);
  const requestedCaregiverId = searchParams.get("caregiverId") || actor.memberName;

  const isCaregiverSelf =
    actor.role === "caregiver" &&
    actor.memberName.toLowerCase() === requestedCaregiverId.toLowerCase();

  // Prevent one caregiver from viewing another caregiver's wellbeing records
  if (actor.role === "caregiver" && !isCaregiverSelf) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Caregivers cannot view peer wellbeing records." },
      { status: 403 }
    );
  }

  // Retrieve history through persistent database repository
  const rawHistory = await careRepository.getWellbeingHistory(requestedCaregiverId, actor.profileId);

  // 2. Server-side privacy enforcement:
  // If the requester is not the caregiver themselves (e.g. family manager or elder owner),
  // strictly filter out entries where shareWithFamily is false.
  const filteredHistory = isCaregiverSelf
    ? rawHistory
    : rawHistory.filter((entry) => entry.shareWithFamily === true);

  const burnoutRisk = getBurnoutRisk(requestedCaregiverId);

  return NextResponse.json(
    {
      history: filteredHistory,
      burnoutRisk,
      privacyEnforced: !isCaregiverSelf,
    },
    { status: 200 }
  );
}
