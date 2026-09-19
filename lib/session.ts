import { createServerSupabase } from "./supabase/server";

export interface CurrentSeller {
  id: string;
  displayName: string;
  isAdmin: boolean;
}

export type SellerLookup =
  | { status: "seller"; seller: CurrentSeller }
  | { status: "not-seller" }
  | { status: "unavailable" };

export async function getCurrentSeller(): Promise<SellerLookup> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "not-seller" };

  const { data, error } = await supabase
    .from("sellers")
    .select("id, display_name, is_admin")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) return { status: "unavailable" };
  if (!data) return { status: "not-seller" };

  return {
    status: "seller",
    seller: { id: data.id, displayName: data.display_name, isAdmin: data.is_admin },
  };
}
