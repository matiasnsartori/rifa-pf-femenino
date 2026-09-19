"use server";

import { revalidatePath } from "next/cache";
import { toSaleError } from "@/lib/errors";
import { isValidNumber } from "@/lib/raffle";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface SaleInput {
  saleNumber: number;
  buyerName: string;
  buyerPhone: string;
}

const NOT_A_SELLER: ActionResult = {
  ok: false,
  message: "Tu cuenta no está habilitada para cargar ventas.",
};

function refreshViews() {
  revalidatePath("/");
  revalidatePath("/panel");
  revalidatePath("/contaduria");
}

export async function createSale(input: SaleInput): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller) return NOT_A_SELLER;

  if (!isValidNumber(input.saleNumber)) {
    return { ok: false, message: "Ese número no existe en la rifa." };
  }
  if (!input.buyerName.trim()) {
    return { ok: false, message: "Cargá el nombre de quien compró." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("sales").insert({
    number: input.saleNumber,
    buyer_name: input.buyerName.trim(),
    buyer_phone: input.buyerPhone.trim() || null,
    seller_id: seller.id,
  });

  const saleError = toSaleError(error, input.saleNumber);
  if (saleError) return { ok: false, message: saleError.message };

  refreshViews();
  return { ok: true };
}

export async function updateSale(input: SaleInput): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller) return NOT_A_SELLER;

  if (!input.buyerName.trim()) {
    return { ok: false, message: "Cargá el nombre de quien compró." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("sales")
    .update({
      buyer_name: input.buyerName.trim(),
      buyer_phone: input.buyerPhone.trim() || null,
    })
    .eq("number", input.saleNumber);

  const saleError = toSaleError(error, input.saleNumber);
  if (saleError) return { ok: false, message: saleError.message };

  refreshViews();
  return { ok: true };
}

export async function releaseSale(saleNumber: number): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller) return NOT_A_SELLER;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("sales").delete().eq("number", saleNumber);

  const saleError = toSaleError(error, saleNumber);
  if (saleError) return { ok: false, message: saleError.message };

  refreshViews();
  return { ok: true };
}
