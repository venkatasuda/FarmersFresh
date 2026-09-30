import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "./rate-limit";

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function readBytes(request: Request, limit = 16_384): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > limit) throw new RequestError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new RequestError(413, "Request too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function readBody(request: Request, limit = 16_384) {
  return (await readBytes(request, limit)).toString("utf8");
}

export async function readObject(request: Request, limit?: number): Promise<Record<string, unknown>> {
  const raw = await readBody(request, limit);
  try {
    const body: unknown = JSON.parse(raw);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new RequestError(400, "Bad request."); }
}

export async function apiRequest(request: NextRequest, handler: (r: NextRequest) => Promise<Response>, scope?: string) {
  try {
    if (scope) {
      const origin = request.headers.get("origin");
      if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== request.nextUrl.origin)) {
        throw new RequestError(403, "Request not allowed.");
      }
      await enforceRateLimit(scope, request.headers, scope === "visual-search" ? 10 : 30);
    }
    const response = await handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    return NextResponse.json({ error: error instanceof RequestError ? error.message : "Request could not be completed." }, {
      status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
    });
  }
}
