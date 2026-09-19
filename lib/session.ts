import { createServerSupabase } from "./supabase/server";

export interface CurrentSeller {
  id: string;
  displayName: string;
  isAdmin: boolean;
}

export async function getCurrentSeller(): Promise<CurrentSeller | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("sellers")
    .select("id, display_name, is_admin")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, displayName: data.display_name, isAdmin: data.is_admin };
}
