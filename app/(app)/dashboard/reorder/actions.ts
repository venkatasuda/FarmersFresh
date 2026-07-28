"use server";

import { getStorefrontLocationId } from "@/lib/stock";
import {
  getReorderSuggestions,
  type ForecastParams,
  type ForecastResult,
} from "@/lib/forecast";
import { createPurchaseOrder } from "../purchasing/actions";

export async function getSuggestions(
  params: ForecastParams
): Promise<ForecastResult> {
  return getReorderSuggestions(params);
}

/**
 * Turn selected reorder suggestions into a DRAFT purchase order, so the buyer
 * reviews and receives it through the normal Purchasing flow. Costs default to
 * each product's last landed cost.
 */
export async function createDraftFromSuggestions(input: {
  supplierId: string | null;
  items: { productId: string; qty: number; unitCost: number }[];
}): Promise<{ ok: true; poNumber: string } | { ok: false; message: string }> {
  const items = input.items.filter((i) => i.qty > 0);
  if (items.length === 0) {
    return { ok: false, message: "Select at least one item to order." };
  }
  const locationId = await getStorefrontLocationId();
  if (!locationId) {
    return { ok: false, message: "No dispatch store is set, so stock has nowhere to land." };
  }
  return createPurchaseOrder({
    locationId,
    supplierId: input.supplierId,
    notes: "From reorder suggestions",
    items,
    markOrdered: false,
  });
}
