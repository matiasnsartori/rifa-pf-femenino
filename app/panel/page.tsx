import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PanelSale } from "@/components/sale-detail";
import { PanelBoard } from "./panel-board";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const lookup = await getCurrentSeller();
  if (lookup.status === "not-seller") redirect("/login");
  if (lookup.status === "unavailable") {
    return (
      <>
        <SiteHeader seller={null} />
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 pb-40">
          <h1 className="font-display text-3xl uppercase tracking-wide">Panel</h1>
          <p role="alert" className="rounded-2xl border border-border bg-card p-4">
            No pudimos verificar tu cuenta. Actualizá la página e intentá de nuevo.
          </p>
        </main>
      </>
    );
  }
  const seller = lookup.seller;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
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
        <span className="text-muted-foreground">
          Alias: Rifa.pf - MercadoPago Martina copperi
        </span>
        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-border bg-card p-4"
          >
            No pudimos cargar las ventas. Actualizá la página antes de vender:
            sin esta información no sabés qué números están tomados.
          </p>
        ) : (
          <PanelBoard sales={sales} seller={seller} />
        )}
      </main>
    </>
  );
}
