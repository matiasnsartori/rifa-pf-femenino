import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AdminSellerRow } from "@/components/sellers-table";
import { AdminBoard } from "./admin-board";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const lookup = await getCurrentSeller();
  if (lookup.status === "not-seller") redirect("/login");
  if (lookup.status === "unavailable") {
    return (
      <>
        <SiteHeader seller={null} />
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
          <h1 className="font-display text-3xl uppercase tracking-wide">Vendedoras</h1>
          <p role="alert" className="rounded-2xl border border-border bg-card p-4">
            No pudimos verificar tu cuenta. Actualizá la página e intentá de nuevo.
          </p>
        </main>
      </>
    );
  }
  const seller = lookup.seller;
  if (!seller.isAdmin) redirect("/panel");

  const supabase = await createServerSupabase();
  const [{ data: sellerRows, error: sellersError }, { data: saleRows, error: salesError }] =
    await Promise.all([
      supabase
        .from("sellers")
        .select("id, email, display_name, is_admin, user_id")
        .order("display_name"),
      supabase.from("sales").select("seller_id"),
    ]);
  const loadFailed = Boolean(sellersError || salesError);

  const sellersWithSales = new Set((saleRows ?? []).map((row) => row.seller_id));

  const rows: AdminSellerRow[] = (sellerRows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    hasSales: sellersWithSales.has(row.id),
    hasLoggedIn: row.user_id !== null,
  }));

  return (
    <>
      <SiteHeader seller={seller} />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
        <h1 className="font-display text-3xl uppercase tracking-wide">Vendedoras</h1>
        {loadFailed ? (
          <p role="alert" className="rounded-2xl border border-border bg-card p-4">
            No pudimos cargar las vendedoras. Actualizá la página antes de dar de alta o de baja a
            alguien.
          </p>
        ) : (
          <AdminBoard rows={rows} />
        )}
      </main>
    </>
  );
}
