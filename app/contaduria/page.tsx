import { redirect } from "next/navigation";
import { AccountingTable } from "@/components/accounting-table";
import { SiteHeader } from "@/components/site-header";
import { summarize } from "@/lib/accounting";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default async function AccountingPage() {
  const seller = await getCurrentSeller();
  if (!seller) redirect("/login");

  const supabase = await createServerSupabase();
  const [
    { data: sellerRows, error: sellersError },
    { data: saleRows, error: salesError },
  ] = await Promise.all([
    supabase.from("sellers").select("id, display_name"),
    supabase.from("sales").select("number, seller_id"),
  ]);

  const loadFailed = Boolean(sellersError || salesError);

  const summary = summarize(
    (sellerRows ?? []).map((row) => ({ id: row.id, displayName: row.display_name })),
    (saleRows ?? []).map((row) => ({ number: row.number, sellerId: row.seller_id })),
  );

  return (
    <>
      <SiteHeader seller={seller} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
        <h1 className="font-display text-3xl uppercase tracking-wide">Números</h1>

        {loadFailed ? (
          <p role="alert" className="rounded-2xl border border-border bg-card p-4">
            No pudimos cargar la contaduría. Actualizá la página antes de confiar en estos montos.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Recaudado</dt>
                <dd className="font-display text-2xl tabular-nums">{money.format(summary.collected)}</dd>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Falta vender</dt>
                <dd className="font-display text-2xl tabular-nums">{money.format(summary.pending)}</dd>
              </div>
            </dl>

            <AccountingTable summary={summary} />
          </>
        )}
      </main>
    </>
  );
}
