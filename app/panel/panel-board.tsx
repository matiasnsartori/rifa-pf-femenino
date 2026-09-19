"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NumberGrid } from "@/components/number-grid";
import { SaleDetail, type PanelSale } from "@/components/sale-detail";
import { SaleForm } from "@/components/sale-form";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { TOTAL_NUMBERS, allNumbers } from "@/lib/raffle";
import { createSale, releaseSale, updateSale } from "@/app/actions/sales";
import type { CurrentSeller } from "@/lib/session";

interface PanelBoardProps {
  sales: PanelSale[];
  seller: CurrentSeller;
}

type Mode = "detail" | "edit" | "create";

export function PanelBoard({ sales, seller }: PanelBoardProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("detail");
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected !== null) sheetRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("sales-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () =>
        router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const byNumber = new Map(sales.map((sale) => [sale.number, sale]));
  const current = selected === null ? null : (byNumber.get(selected) ?? null);

  const needle = query.trim().toLowerCase();
  const visibleNumbers = needle
    ? allNumbers().filter(
        (value) =>
          String(value).includes(needle) ||
          (byNumber.get(value)?.buyerName.toLowerCase().includes(needle) ?? false),
      )
    : undefined;

  function open(value: number) {
    setActionError(null);
    setSelected(value);
    setMode(byNumber.has(value) ? "detail" : "create");
  }

  function close() {
    setActionError(null);
    setSelected(null);
  }

  async function release() {
    if (selected === null) return;
    if (!window.confirm(`¿Liberar el número ${selected}? Se borra la venta.`)) return;

    const result = await releaseSale(selected);
    if (!result.ok) {
      setActionError(result.message ?? "No se pudo liberar el número.");
      return;
    }
    close();
  }

  return (
    <>
      <p className="text-muted-foreground tabular-nums">
        {TOTAL_NUMBERS - sales.length} libres · {sales.length} vendidos
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="search" className="text-sm font-semibold">
          Buscar por número o por quien compró
        </label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-card px-4 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {visibleNumbers?.length === 0 ? (
        <p className="text-muted-foreground">No hay números que coincidan con “{query}”.</p>
      ) : (
        <NumberGrid
          soldNumbers={sales.map((sale) => sale.number)}
          numbers={visibleNumbers}
          onSelect={open}
        />
      )}

      {selected !== null && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Número ${selected}`}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className="animate-rise fixed inset-x-0 bottom-0 z-10 rounded-t-3xl border-t border-border bg-card p-5 text-card-foreground shadow-2xl focus-visible:outline-none"
        >
          {actionError && (
            <p role="alert" className="mb-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              {actionError}
            </p>
          )}

          {mode !== "create" && !current && (
            <div className="flex flex-col gap-3">
              <p role="alert" className="text-sm">
                El número {selected} fue liberado mientras lo mirabas.
              </p>
              <button
                type="button"
                onClick={close}
                className="min-h-[44px] touch-manipulation rounded-xl border border-border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cerrar
              </button>
            </div>
          )}

          {mode === "create" && current && (
            <div className="flex flex-col gap-3">
              <p role="alert" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                Mientras cargabas, {current.sellerName} vendió el {current.number}. Elegí otro.
              </p>
              <SaleDetail
                sale={current}
                canEdit={seller.isAdmin || current.sellerId === seller.id}
                onEdit={() => setMode("edit")}
                onRelease={release}
                onClose={close}
              />
            </div>
          )}

          {mode === "create" && !current && (
            <SaleForm
              saleNumber={selected}
              onSubmit={async (input) => {
                const result = await createSale(input);
                if (result.ok) close();
                return result;
              }}
              onCancel={close}
            />
          )}

          {mode === "edit" && current && (
            <SaleForm
              saleNumber={current.number}
              initialName={current.buyerName}
              initialPhone={current.buyerPhone ?? ""}
              onSubmit={async (input) => {
                const result = await updateSale(input);
                if (result.ok) setMode("detail");
                return result;
              }}
              onCancel={() => setMode("detail")}
            />
          )}

          {mode === "detail" && current && (
            <SaleDetail
              sale={current}
              canEdit={seller.isAdmin || current.sellerId === seller.id}
              onEdit={() => setMode("edit")}
              onRelease={release}
              onClose={close}
            />
          )}
        </div>
      )}
    </>
  );
}
