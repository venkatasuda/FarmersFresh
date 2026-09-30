import "server-only";
import sharp from "sharp";
import { RequestError } from "@/server/security/http";

export async function safeImage(bytes: Buffer): Promise<Buffer> {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new RequestError(413, "Keep photos under 5 MB.");
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error();
    // Decode and re-encode: discard original metadata and embedded payloads.
    return await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch { throw new RequestError(415, "Upload a valid JPEG, PNG, WebP or AVIF photo."); }
}
