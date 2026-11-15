export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export function isValidFileExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function getExpectedMimeFromExtension(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [ext, mime] of Object.entries(EXTENSION_MIME_MAP)) {
    if (lower.endsWith(ext)) return mime;
  }
  return null;
}

/**
 * Validates actual binary signature (magic bytes) of the file buffer.
 */
export function isValidFileSignature(buffer: Buffer): { valid: boolean; format?: string } {
  if (!buffer || buffer.length < 4) return { valid: false };

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: "image/png" };
  }

  // PDF: %PDF (25 50 44 46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { valid: true, format: "application/pdf" };
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, format: "image/webp" };
  }

  return { valid: false };
}

/**
 * Deep structural validation and agreement checks for uploaded prescription images & PDFs.
 * Rejects corrupt, malformed, mismatched, and suspicious polyglot files.
 */
export function validatePrescriptionFile(
  filename: string,
  declaredMime: string,
  buffer: Buffer
): { valid: boolean; error?: string; format?: string } {
  // 1. Extension check first
  if (!isValidFileExtension(filename)) {
    return {
      valid: false,
      error: "Invalid file extension. Only .jpg, .jpeg, .png, .webp, or .pdf files are accepted.",
    };
  }

  // 2. Minimum buffer length
  if (!buffer || buffer.length < 4) {
    return { valid: false, error: "File is truncated, empty, or unreadable." };
  }

  const expectedMime = getExpectedMimeFromExtension(filename);
  if (!expectedMime) {
    return { valid: false, error: "Unrecognized file extension." };
  }

  // 3. MIME type agreement
  const normalizedMime = (declaredMime || "").toLowerCase().trim();
  if (normalizedMime && !ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    return {
      valid: false,
      error: "Unsupported MIME type. Only JPEG, PNG, WebP or PDF documents are accepted.",
    };
  }

  if (normalizedMime && normalizedMime !== expectedMime) {
    return {
      valid: false,
      error: `Declared MIME type (${normalizedMime}) does not match file extension (${expectedMime}).`,
    };
  }

  // 4. Binary signature verification
  const sig = isValidFileSignature(buffer);
  if (!sig.valid || !sig.format) {
    return {
      valid: false,
      error: "Invalid file signature. File header does not match expected image or PDF format.",
    };
  }

  // 5. Signature agreement with extension & MIME
  if (sig.format !== expectedMime) {
    return {
      valid: false,
      error: `Detected binary format (${sig.format}) disagrees with filename extension (${expectedMime}).`,
    };
  }

  // 6. Deep format checks on larger payloads (>= 128 bytes)
  if (buffer.length >= 128) {
    if (sig.format === "application/pdf") {
      const header = buffer.subarray(0, 8).toString("ascii");
      if (!header.startsWith("%PDF")) {
        return { valid: false, error: "Malformed PDF header." };
      }
      // Check for presence of EOF or trailer in larger PDFs
      const tail = buffer.subarray(Math.max(0, buffer.length - 1024)).toString("latin1");
      if (!tail.includes("%%EOF") && !tail.includes("trailer") && !tail.includes("xref")) {
        return { valid: false, error: "Malformed or truncated PDF document." };
      }
    } else if (sig.format === "image/png") {
      const chunkType = buffer.subarray(12, 16).toString("ascii");
      if (chunkType !== "IHDR") {
        return { valid: false, error: "Malformed PNG image. First chunk must be 'IHDR'." };
      }
    } else if (sig.format === "image/webp") {
      const vp8Header = buffer.subarray(12, 16).toString("ascii");
      if (!["VP8 ", "VP8L", "VP8X"].includes(vp8Header)) {
        return { valid: false, error: "Malformed WebP image. Missing VP8/VP8L/VP8X chunk header." };
      }
    }
  }

  return { valid: true, format: sig.format };
}
