import { NextRequest, NextResponse } from "next/server";
import { careRepository } from "@/lib/db/repository";
import { calculateWellbeingRisk } from "@/lib/wellbeingStore";
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
  const requestedCaregiverId = searchParams.get("caregiverId");
  const requestedProfileId = searchParams.get("profileId");

  // Cross-profile boundary check: users cannot query unrelated care profiles
  if (requestedProfileId && requestedProfileId !== actor.profileId) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Cross-profile access denied." },
      { status: 403 }
    );
  }

  const selfId = actor.memberId || actor.memberName;
  const isCaregiverSelf =
    actor.role === "caregiver" &&
    (!requestedCaregiverId ||
      requestedCaregiverId.toLowerCase() === selfId.toLowerCase() ||
      requestedCaregiverId.toLowerCase() === actor.memberName.toLowerCase());

  // Prevent one caregiver from viewing another caregiver's private wellbeing records
  if (actor.role === "caregiver" && !isCaregiverSelf) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Caregivers cannot view peer wellbeing records." },
      { status: 403 }
    );
  }

  // Determine query caregiver ID
  const queryCaregiverId = isCaregiverSelf ? selfId : requestedCaregiverId || selfId;

  // Retrieve history through persistent database repository scoped by careProfileId
  const rawHistory = await careRepository.getWellbeingHistory(queryCaregiverId, actor.profileId);

  // 2. Server-side privacy enforcement:
  // If the requester is not the caregiver themselves (e.g. family manager or elder owner),
  // strictly filter out entries where shareWithFamily is false.
  const filteredHistory = isCaregiverSelf
    ? rawHistory
    : rawHistory.filter((entry) => entry.shareWithFamily === true);

  // Calculate persistent non-diagnostic risk assessment
  const riskAssessment = calculateWellbeingRisk(filteredHistory);

  return NextResponse.json(
    {
      history: filteredHistory,
      burnoutRisk: riskAssessment.level,
      assessment: riskAssessment,
      privacyEnforced: !isCaregiverSelf,
    },
    { status: 200 }
  );
}
