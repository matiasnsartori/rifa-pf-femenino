import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PanelSale } from "@/components/sale-detail";
import { PanelBoard } from "./panel-board";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const seller = await getCurrentSeller();
  if (!seller) redirect("/login");

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("sales")
    .select("number, buyer_name, buyer_phone, seller_id, sold_at, sellers(display_name)")
    .order("number");

  const sales: PanelSale[] = (data ?? []).map((row) => ({
    number: row.number,
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone,
    sellerId: row.seller_id,
    sellerName:
      (row.sellers as unknown as { display_name: string } | null)?.display_name ?? "Sin dato",
    soldAt: row.sold_at,
  }));

  return (
    <>
      <SiteHeader seller={seller} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 pb-40">
        <h1 className="font-display text-3xl uppercase tracking-wide">Panel</h1>
        <PanelBoard sales={sales} seller={seller} />
      </main>
    </>
  );
}
