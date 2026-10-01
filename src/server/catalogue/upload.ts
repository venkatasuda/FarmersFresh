import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { readBytes, RequestError } from "@/server/security/http";
import { safeImage } from "./images";

export async function uploadProductImage(request: NextRequest) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new RequestError(401, "Please sign in.");
  const { data: owner, error: permissionError } = await client.rpc("is_org_owner");
  if (permissionError || owner !== true) throw new RequestError(403, "You cannot upload photos.");
  const bytes = await safeImage(await readBytes(request, 5 * 1024 * 1024));
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const path = `${user.id}/${randomUUID()}.jpg`;
  const { error: uploadError } = await admin.storage.from("product-images").upload(path, bytes, {
    contentType: "image/jpeg", cacheControl: "31536000", upsert: false,
  });
  if (uploadError) throw new RequestError(502, "Photo upload failed. Please try again.");
  return NextResponse.json({ url: admin.storage.from("product-images").getPublicUrl(path).data.publicUrl });
}
