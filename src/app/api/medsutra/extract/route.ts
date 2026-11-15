import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ExtractionSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  instructions: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  uncertain_fields: z.array(z.string()),
});

const ExtractionArraySchema = z.array(ExtractionSchema);

const DEMO_EXTRACTIONS = [
  {
    name: "Metformin ER",
    dosage: "500mg",
    frequency: "Once daily with breakfast",
    duration: "90 days",
    instructions: "Take with food",
    confidence: "high" as const,
    uncertain_fields: [],
  },
  {
    name: "Lisinopril",
    dosage: "10mg",
    frequency: "Once daily",
    duration: "Ongoing",
    instructions: "Morning preferred",
    confidence: "medium" as const,
    uncertain_fields: ["duration"],
  },
];

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Expected multipart/form-data" },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("prescription") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Missing prescription field" },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File exceeds 10MB limit" },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "application/pdf",
    ];
    if (!allowedTypes.some((t) => file.type.startsWith("image/") || file.type === "application/pdf")) {
      // Check more loosely — accept any image/* or pdf
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        return NextResponse.json(
          { success: false, error: "Only image or PDF files are accepted" },
          { status: 400, headers: { "X-Verification-Required": "true" } }
        );
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Demo mode — no API key
      return NextResponse.json(
        { success: true, source: "demo", extractions: DEMO_EXTRACTIONS },
        { headers: { "X-Verification-Required": "true" } }
      );
    }

    // Gemini mode
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `You are a medical prescription reader. Extract all medicines from this prescription image.
Return ONLY a valid JSON array (no markdown, no extra text) with each medicine as an object containing these fields:
- name: string (medicine name)
- dosage: string (e.g. "500mg")
- frequency: string (e.g. "Once daily", "Twice daily with meals")
- duration: string (e.g. "30 days", "Ongoing")
- instructions: string (special instructions, e.g. "Take with food", "Avoid sunlight")
- confidence: "high" | "medium" | "low" (how clearly readable this entry is)
- uncertain_fields: string[] (list of field names that were hard to read, e.g. ["dosage", "duration"])

Example output:
[{"name":"Metformin","dosage":"500mg","frequency":"Once daily","duration":"90 days","instructions":"Take with food","confidence":"high","uncertain_fields":[]}]`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type as string,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();

    // Strip markdown code fences if present
    const cleaned = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse Gemini response as JSON", raw: responseText },
        { status: 500, headers: { "X-Verification-Required": "true" } }
      );
    }

    const validated = ExtractionArraySchema.safeParse(parsed);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Gemini response schema mismatch", details: validated.error.issues },
        { status: 500, headers: { "X-Verification-Required": "true" } }
      );
    }

    return NextResponse.json(
      { success: true, source: "gemini", extractions: validated.data },
      { headers: { "X-Verification-Required": "true" } }
    );
  } catch (error) {
    console.error("[MedSutra extract]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: { "X-Verification-Required": "true" } }
    );
  }
}
