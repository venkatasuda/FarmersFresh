/**
 * SERVER ONLY — turns a short string into an inline SVG QR code.
 *
 * Used for the customer's loyalty card (encodes only their loyalty code, never
 * personal data). Returns an <svg> string to drop straight into the page; on
 * any failure it returns "" so a missing QR never breaks the page.
 */
import QRCode from "qrcode";

export async function qrSvg(text: string): Promise<string> {
  if (!text) return "";
  try {
    return await QRCode.toString(text, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#14532d", light: "#ffffff" },
    });
  } catch {
    return "";
  }
}
