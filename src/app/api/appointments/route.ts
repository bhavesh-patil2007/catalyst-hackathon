import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";

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
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createAppointmentSchema.parse(body);

    const newAppt = guardianStore.addAppointment({
      ...validated,
      status: "UPCOMING",
    });

    return NextResponse.json({ success: true, data: newAppt }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to create appointment" },
      { status: 500 }
    );
  }
}
