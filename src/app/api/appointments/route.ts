import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const createAppointmentSchema = z.object({
  doctorName: z.string().min(2),
  specialty: z.string().min(2),
  clinicName: z.string().min(2),
  address: z.string().min(3),
  dateTime: z.string().min(2),
  dateLabel: z.string().min(2),
  timeLabel: z.string().min(2),
  transportAssigned: z.boolean().default(false),
  transportDetails: z.string().optional(),
  questionsToAsk: z.array(z.string()).default([]),
  postVisitNotes: z.string().optional(),
  careProfileId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createAppointmentSchema.parse(body);

    // Enforce server-side authorization: read_only members cannot schedule appointments
    const authResult = await getActorFromSessionOrHeader(
      request,
      ["owner", "family_manager", "caregiver"],
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

    const newAppt = guardianStore.addAppointment({
      doctorName: validated.doctorName,
      specialty: validated.specialty,
      clinicName: validated.clinicName,
      address: validated.address,
      dateTime: validated.dateTime,
      dateLabel: validated.dateLabel,
      timeLabel: validated.timeLabel,
      transportAssigned: validated.transportAssigned,
      transportDetails: validated.transportDetails,
      questionsToAsk: validated.questionsToAsk,
      postVisitNotes: validated.postVisitNotes,
      status: "UPCOMING",
    });

    return NextResponse.json({ success: true, data: newAppt }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to schedule appointment" },
      { status: 500 }
    );
  }
}
