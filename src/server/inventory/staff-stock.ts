import "server-only";
import type { StockResult, StockTransfer } from "@/lib/contracts/staff-stock";
import { isUuid, sanitizeError } from "@/lib/guard";
import { STOCK_REASONS } from "@/lib/types";
import { createClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Records a stock movement.
 *
 * The UI sends a positive amount plus a reason; the SIGN is decided here from
 * the reason, not by the caller. Letting a form post "-5" invites a typo that
 * turns a delivery into a write-off, and there is no undo on a ledger — only
 * a correcting entry.
 */
export async function recordStock(
  locationId: string,
  productId: string,
  amount: number,
  reason: string,
  note: string
): Promise<StockResult> {
  if (![locationId,productId].every(isUuid) || typeof note!=="string" || note.length>500)
    return { ok:false,message:"Check the product, store and note." };
  const spec = STOCK_REASONS.find((r) => r.value === reason);
  if (!spec) return { ok: false, message: "Pick a reason." };

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }
  if (amount > 1000) {
    return { ok: false, message: "That looks too large — check the amount." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("record_stock", {
    p_location: locationId,
    p_product: productId,
    p_delta: amount * spec.sign,
    p_reason: reason,
    p_note: note.trim() || null,
  });

  if (error) {
    // record_stock raises readable messages for the cases staff can fix
    // (below zero, no access to that location); sanitize anything unexpected.
    return { ok: false, message: sanitizeError(error.message) };
  }

  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/expiry");
  revalidatePath("/dashboard/wastage");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true };
}

export async function countStock(id: string, location: string, product: string, count: number, expected: number, note: string): Promise<StockResult> {
  if (![id,location,product].every(isUuid) || !Number.isFinite(count) || count<0 || count>100000 || !Number.isFinite(expected) || expected<0)
    return { ok: false, message: "Enter a valid stock quantity." };
  if (typeof note!=="string" || !note.trim() || note.length>500) return { ok: false, message: "Give a count reason within 500 characters." };
  const supabase=await createClient();
  const { error }=await supabase.rpc("count_stock", { p_id:id,p_location:location,p_product:product,p_count:count,p_expected:expected,p_note:note.trim() });
  if (error) return { ok:false,message:sanitizeError(error.message) };
  revalidatePath("/dashboard/stock"); revalidatePath("/dashboard"); revalidatePath("/");
  return { ok:true };
}

export async function dispatchTransfer(id: string, source: string, destination: string, product: string, quantity: number, note: string): Promise<StockResult> {
  if (![id,source,destination,product].every(isUuid) || !Number.isFinite(quantity) || quantity<=0 || quantity>100000)
    return { ok:false,message:"Enter a valid stock quantity." };
  if (typeof note!=="string" || note.length>500) return { ok:false,message:"Keep the note within 500 characters." };
  const supabase=await createClient();
  const { error }=await supabase.rpc("dispatch_stock_transfer", { p_id:id,p_source:source,p_destination:destination,p_product:product,p_quantity:quantity,p_note:note.trim() });
  if (error) return { ok:false,message:sanitizeError(error.message) };
  revalidatePath("/dashboard/stock"); revalidatePath("/dashboard/expiry"); revalidatePath("/");
  return { ok:true };
}

export async function receiveTransfer(id: string): Promise<StockResult> {
  if (!isUuid(id)) return { ok:false,message:"Choose a transfer." };
  const supabase=await createClient();
  const { error }=await supabase.rpc("receive_stock_transfer", { p_id:id });
  if (error) return { ok:false,message:sanitizeError(error.message) };
  revalidatePath("/dashboard/stock"); revalidatePath("/dashboard/expiry"); revalidatePath("/dashboard/wastage"); revalidatePath("/");
  return { ok:true };
}

export async function getTransfers(location: string): Promise<{ destinations: { id:string; name:string }[]; transfers:StockTransfer[] }> {
  if (!isUuid(location)) throw new Error("Choose a store.");
  const supabase=await createClient();
  const [destinations,result]=await Promise.all([
    supabase.rpc("stock_transfer_locations", { p_source:location }),
    supabase.from("stock_transfers").select("id,source_id,destination_id,quantity,status,created_at,products(name,unit),source:locations!source_id(name),destination:locations!destination_id(name)")
      .or(`source_id.eq.${location},destination_id.eq.${location}`).order("status").order("created_at",{ascending:false}).limit(100),
  ]);
  if (destinations.error || result.error) throw new Error("Transfers are temporarily unavailable.");
  type Row={ id:string; source_id:string; destination_id:string; quantity:number; status:StockTransfer["status"]; created_at:string;
    products:{ name:string; unit:"kg"|"piece" }; source:{name:string}; destination:{name:string} };
  return { destinations:destinations.data as {id:string;name:string}[], transfers:(result.data as unknown as Row[]).map(t=>({
    id:t.id,sourceId:t.source_id,destinationId:t.destination_id,source:t.source.name,destination:t.destination.name,
    quantity:Number(t.quantity),status:t.status,createdAt:t.created_at,product:t.products.name,unit:t.products.unit,
  })) };
}
