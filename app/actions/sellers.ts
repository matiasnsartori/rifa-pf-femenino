"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "./sales";

const NOT_ADMIN: ActionResult = {
  ok: false,
  message: "Solo una admin puede gestionar las vendedoras.",
};

const UNAVAILABLE: ActionResult = {
  ok: false,
  message: "No pudimos verificar tu cuenta. Probá de nuevo en un momento.",
};

const HAS_SALES = "23503";
const LAST_ADMIN = "P0001";

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function addSeller(input: {
  email: string;
  displayName: string;
}): Promise<ActionResult> {
  const lookup = await getCurrentSeller();
  if (lookup.status === "unavailable") return UNAVAILABLE;
  if (lookup.status === "not-seller" || !lookup.seller.isAdmin) return NOT_ADMIN;

  const email = input.email.trim().toLowerCase();
  if (!looksLikeEmail(email)) return { ok: false, message: "Ese email no parece válido." };
  if (!input.displayName.trim()) return { ok: false, message: "Cargá el nombre." };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("sellers")
    .insert({ email, display_name: input.displayName.trim() });

  if (error?.code === "23505") return { ok: false, message: "Ese email ya está en la lista." };
  if (error) return { ok: false, message: "No se pudo agregar. Probá de nuevo." };

  revalidatePath("/admin");
  return { ok: true };
}

export async function setAdmin(sellerId: string, isAdmin: boolean): Promise<ActionResult> {
  const lookup = await getCurrentSeller();
  if (lookup.status === "unavailable") return UNAVAILABLE;
  if (lookup.status === "not-seller" || !lookup.seller.isAdmin) return NOT_ADMIN;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("sellers")
    .update({ is_admin: isAdmin })
    .eq("id", sellerId)
    .select("id");

  if (error?.code === LAST_ADMIN) {
    return { ok: false, message: "No puede quedar la rifa sin ninguna admin." };
  }
  if (error) {
    return { ok: false, message: "No se pudo cambiar. Probá de nuevo en un momento." };
  }
  if (!data?.length) {
    return { ok: false, message: "No se pudo cambiar. Esa vendedora ya no existe." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function removeSeller(sellerId: string): Promise<ActionResult> {
  const lookup = await getCurrentSeller();
  if (lookup.status === "unavailable") return UNAVAILABLE;
  if (lookup.status === "not-seller" || !lookup.seller.isAdmin) return NOT_ADMIN;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("sellers")
    .delete()
    .eq("id", sellerId)
    .select("id");

  if (error?.code === HAS_SALES) {
    return { ok: false, message: "Tiene ventas cargadas. No se puede borrar." };
  }
  if (error?.code === LAST_ADMIN) {
    return { ok: false, message: "No puede quedar la rifa sin ninguna admin." };
  }
  if (error) {
    return { ok: false, message: "No se pudo borrar. Probá de nuevo en un momento." };
  }
  if (!data?.length) {
    return { ok: false, message: "No se pudo borrar. Esa vendedora ya no existe." };
  }

  revalidatePath("/admin");
  return { ok: true };
}
