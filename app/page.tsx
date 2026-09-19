import { NumberGrid } from "@/components/number-grid";
import { InstallApp } from "@/components/install-app";
import { SiteHeader } from "@/components/site-header";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { TOTAL_NUMBERS } from "@/lib/raffle";

export const revalidate = 10;

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("public_numbers").select("number");
  const soldNumbers = (data ?? []).map((row) => row.number);
  const seller = await getCurrentSeller();

  return (
    <>
      <SiteHeader seller={seller} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide">Rifa PF Femenino</h1>
          <p className="mt-1 text-muted-foreground tabular-nums">
            {TOTAL_NUMBERS - soldNumbers.length} libres · {soldNumbers.length} vendidos
          </p>
        </div>
        <InstallApp />
        <NumberGrid soldNumbers={soldNumbers} />
      </main>
    </>
  );
}
