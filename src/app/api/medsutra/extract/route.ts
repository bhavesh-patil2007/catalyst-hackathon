import { isValidFileSignature } from "@/lib/fileValidation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const ExtractionSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  instructions: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  uncertain_fields: z.array(z.string()),
  plain_language_explanation: z.string(),
  plain_language_hi: z.string().optional(),
  plain_language_mr: z.string().optional(),
  handwriting_alert: z.string().optional(),
});

const ExtractionArraySchema = z.array(ExtractionSchema);

const DEMO_EXTRACTIONS = [
  {
    name: "Metformin ER",
    dosage: "500 mg",
    frequency: "Once daily with breakfast",
    duration: "90 days",
    instructions: "Take with breakfast and a glass of water.",
    confidence: "high" as const,
    uncertain_fields: [],
    plain_language_explanation:
      "A daily medication that helps lower and balance blood glucose levels for Type 2 Diabetes by reducing liver sugar production.",
    plain_language_hi:
      "यह दवा टाइप 2 मधुमेह के लिए भोजन के बाद रक्त शर्करा (ब्लड शुगर) को नियंत्रित करने में मदद करती है।",
    plain_language_mr:
      "हे औषध टाइप २ मधुमेहासाठी जेवणानंतर रक्तातील साखर नियंत्रित ठेवण्यास मदत करते.",
    handwriting_alert: undefined,
  },
  {
    name: "Lisinopril",
    dosage: "10 mg",
    frequency: "Once daily in the morning",
    duration: "Ongoing",
    instructions: "Blood pressure tablet. Do not take with salt substitutes.",
    confidence: "medium" as const,
    uncertain_fields: ["duration"],
    plain_language_explanation:
      "Relaxes blood vessels so blood flows more easily, protecting against high blood pressure and cardiac strain.",
    plain_language_hi:
      "यह उच्च रक्तचाप को कम करने और हृदय को स्वस्थ रखने के लिए रक्त वाहिकाओं को शिथिल करता है।",
    plain_language_mr:
      "हे उच्च रक्तदाब कमी करण्यासाठी आणि हृदयाचे रक्षण करण्यासाठी रक्तवाहिन्या शिथिल करते.",
    handwriting_alert:
      "Doctor's handwriting for duration was partially faded. Verification with dispensing pharmacist is advised.",
  },
];

// Rate limiting map for prescription analysis
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(identifier);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(identifier, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count += 1;
  return true;
}



export async function POST(request: NextRequest) {
  try {
    // 1. Authorization: Only authenticated circle members can access prescription extraction
    const authResult = await getActorFromSessionOrHeader(request, [
      "owner",
      "family_manager",
      "caregiver",
    ]);

    if (!authResult.success) {
      return authResult.response;
    }

    const { actor } = authResult;

    // 2. Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || actor.profileId;
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many extraction requests. Please wait a minute." },
        { status: 429, headers: { "X-Verification-Required": "true" } }
      );
    }

    // 3. Content-Type verification
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
        { success: false, error: "Missing prescription file" },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    // 4. File size validation (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File exceeds 10MB limit" },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    // 5. Binary magic-byte signature validation (prevents MIME type spoofing)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const signatureCheck = isValidFileSignature(buffer);

    if (!signatureCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file signature. Only authentic JPEG, PNG, WebP or PDF files are accepted.",
        },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Demo mode fallback — returns verified clinical sample extractions
      return NextResponse.json(
        {
          success: true,
          source: "demo",
          extractions: DEMO_EXTRACTIONS,
          message: "Processed via MedSutra demo mode (GEMINI_API_KEY not configured).",
        },
        { headers: { "X-Verification-Required": "true" } }
      );
    }

    // Live Google Gemini Vision Extraction
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const base64Data = buffer.toString("base64");
    const detectedMime = signatureCheck.format || file.type || "image/jpeg";

    const prompt = `You are MedSutra AI, a clinical prescription extraction assistant.
Extract all medications from this medical prescription document or image.

SAFETY & EXTRACTION RULES:
1. Never guess illegible or smudged handwriting. If a field is hard to read, mark confidence as "medium" or "low", add the field name to uncertain_fields, and explain in handwriting_alert.
2. Never recommend or alter dosages independently.
3. For each medicine, provide:
   - name: Exact medicine brand or generic name
   - dosage: Strength (e.g., "500 mg", "10 mg")
   - frequency: How often to take (e.g., "Once daily with breakfast")
   - duration: How long (e.g., "30 days", "Ongoing")
   - instructions: Special timing or meal instructions
   - confidence: "high" | "medium" | "low"
   - uncertain_fields: list of field names that were ambiguous
   - plain_language_explanation: Simple 1-sentence explanation of what this medicine does in plain English for an elderly patient.
   - plain_language_hi: Same explanation translated into natural Hindi (Devanagari script).
   - plain_language_mr: Same explanation translated into natural Marathi (Devanagari script).
   - handwriting_alert: Warning note if doctor's handwriting was unclear or ambiguous.

Return ONLY a raw valid JSON array matching this schema without markdown fences or additional prose.`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: detectedMime,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();

    const cleaned = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Strictly sanitize: NEVER return raw response text or internal details
      return NextResponse.json(
        {
          success: false,
          error: "Unable to parse prescription structure. Please provide a clearer image.",
        },
        { status: 422, headers: { "X-Verification-Required": "true" } }
      );
    }

    const validated = ExtractionArraySchema.safeParse(parsed);
    if (!validated.success) {
      // Strictly sanitize: NEVER leak schema details or internal exception paths
      return NextResponse.json(
        {
          success: false,
          error: "Prescription extraction did not meet clinical structure standards.",
        },
        { status: 422, headers: { "X-Verification-Required": "true" } }
      );
    }

    return NextResponse.json(
      { success: true, source: "gemini", extractions: validated.data },
      { headers: { "X-Verification-Required": "true" } }
    );
  } catch (error: any) {
    // Log privately on server; NEVER return stack traces or raw error messages to client
    console.error("[MedSutra extract] Server error:", error?.message);
    return NextResponse.json(
      {
        success: false,
        error: "Prescription processing encountered an error. Please try again.",
      },
      { status: 500, headers: { "X-Verification-Required": "true" } }
    );
  }
}
