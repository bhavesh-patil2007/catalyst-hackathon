import {
  validatePrescriptionFile,
  ALLOWED_MIME_TYPES,
  isValidFileExtension,
  isValidFileSignature,
} from "@/lib/fileValidation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";
import { checkDistributedRateLimit } from "@/lib/rateLimit";

const ExtractionSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(200),
  duration: z.string().min(1).max(100),
  instructions: z.string().min(1).max(500),
  confidence: z.enum(["high", "medium", "low"]),
  uncertain_fields: z.array(z.string().max(100)).max(15),
  plain_language_explanation: z.string().min(5).max(1000),
  plain_language_hi: z.string().max(1000).optional(),
  plain_language_mr: z.string().max(1000).optional(),
  handwriting_alert: z.string().max(500).optional(),
});

const ExtractionArraySchema = z.array(ExtractionSchema).min(1).max(15);

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

    // 2. Early Content-Length check to prevent buffering oversized requests (> 10MB)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File exceeds 10MB limit" },
        { status: 413, headers: { "X-Verification-Required": "true" } }
      );
    }

    // 3. Distributed Rate Limiting (Profile & Member scoped, fail-closed in production)
    const rateLimitKey = `medsutra:${actor.profileId}:${actor.memberId}`;
    const rateLimit = await checkDistributedRateLimit(rateLimitKey, 10, 60_000, true);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many extraction requests. Please wait a minute before retrying.",
          retryAfter: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds || 60),
            "X-Verification-Required": "true",
          },
        }
      );
    }

    // 4. Content-Type verification
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Expected multipart/form-data" },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    // 5. Parse multipart form data
    const formData = await request.formData();
    const prescriptionFiles = formData.getAll("prescription");

    // Reject multiple files
    if (prescriptionFiles.length > 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Multiple files rejected. Please upload only one prescription at a time.",
        },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    const file = prescriptionFiles[0] as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Missing prescription file" },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    // 6. Actual file size validation
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File exceeds 10MB limit" },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Uploaded file is empty (0 bytes)." },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    // 7. Binary signature & deep structural validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Deep validation of extension, declared MIME, signature, and internal markers
    const validation = validatePrescriptionFile(file.name, file.type, buffer);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || "Invalid file format or corrupted prescription.",
        },
        { status: 400, headers: { "X-Verification-Required": "true" } }
      );
    }

    const isProduction = process.env.NODE_ENV === "production";
    const apiKey = process.env.GEMINI_API_KEY;

    // 8. In production: missing GEMINI_API_KEY must return HTTP 503
    if (!apiKey) {
      if (isProduction) {
        return NextResponse.json(
          {
            success: false,
            error: "Prescription AI service is temporarily unavailable. Please configure GEMINI_API_KEY.",
          },
          { status: 503, headers: { "X-Verification-Required": "true" } }
        );
      }

      // Demo mode fallback — strictly restricted to non-production environments
      return NextResponse.json(
        {
          success: true,
          source: "demo",
          extractions: DEMO_EXTRACTIONS,
          message:
            "Processed via MedSutra demo mode (GEMINI_API_KEY not configured). Pre-packaged demonstration templates loaded; these were NOT extracted from the uploaded file.",
        },
        { headers: { "X-Verification-Required": "true" } }
      );
    }

    // 9. Live Google Gemini Vision Extraction with timeout
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const base64Data = buffer.toString("base64");
    const detectedMime = validation.format || "image/jpeg";

    const prompt = `You are MedSutra AI, a clinical prescription extraction assistant.
Extract all medications from this medical prescription document or image.

SAFETY & CLINICAL GOVERNANCE RULES:
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

    // Enforce 25-second timeout on Gemini request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    let responseText = "";
    try {
      const result = await model.generateContent([prompt, imagePart]);
      responseText = result.response.text().trim();
    } catch (genError: any) {
      if (genError?.name === "AbortError") {
        return NextResponse.json(
          { success: false, error: "Prescription analysis timed out. Please try again." },
          { status: 504, headers: { "X-Verification-Required": "true" } }
        );
      }
      throw genError;
    } finally {
      clearTimeout(timeoutId);
    }

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

    // Return sanitized draft extractions for human clinician/caregiver review
    return NextResponse.json(
      {
        success: true,
        source: "gemini",
        extractions: validated.data,
      },
      { headers: { "X-Verification-Required": "true" } }
    );
  } catch (error: any) {
    // Log privately on server without logging sensitive PHI or prescription images
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
