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

async function sellerWhoTook(saleNumber: number): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("sales")
    .select("sellers(display_name)")
    .eq("number", saleNumber)
    .maybeSingle();

  return (data?.sellers as unknown as { display_name: string } | null)?.display_name ?? null;
}

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
  if (saleError?.kind === "number-taken") {
    const takenBy = await sellerWhoTook(input.saleNumber);
    return {
      ok: false,
      message: takenBy
        ? `El ${input.saleNumber} lo acaba de vender ${takenBy}. Elegí otro.`
        : saleError.message,
    };
  }
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
  const { data, error } = await supabase
    .from("sales")
    .update({
      buyer_name: input.buyerName.trim(),
      buyer_phone: input.buyerPhone.trim() || null,
    })
    .eq("number", input.saleNumber)
    .select("number");

  const saleError = toSaleError(error, input.saleNumber);
  if (saleError) return { ok: false, message: saleError.message };
  if (!data?.length) {
    return { ok: false, message: "No se pudo editar. Esa venta ya no es tuya o fue liberada." };
  }

  refreshViews();
  return { ok: true };
}

export async function releaseSale(saleNumber: number): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller) return NOT_A_SELLER;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("sales")
    .delete()
    .eq("number", saleNumber)
    .select("number");

  const saleError = toSaleError(error, saleNumber);
  if (saleError) return { ok: false, message: saleError.message };
  if (!data?.length) {
    return { ok: false, message: "No se pudo liberar. Esa venta ya no es tuya o fue liberada." };
  }

  refreshViews();
  return { ok: true };
}
