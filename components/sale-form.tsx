"use client";

import { useState } from "react";
import type { ActionResult, SaleInput } from "@/app/actions/sales";

interface SaleFormProps {
  saleNumber: number;
  initialName?: string;
  initialPhone?: string;
  onSubmit: (input: SaleInput) => Promise<ActionResult>;
  onCancel: () => void;
}

export function SaleForm({
  saleNumber,
  initialName = "",
  initialPhone = "",
  onSubmit,
  onCancel,
}: SaleFormProps) {
  const [buyerName, setBuyerName] = useState(initialName);
  const [buyerPhone, setBuyerPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buyerName.trim()) {
      setError("Cargá el nombre de quien compró.");
      return;
    }
    setError(null);
    setSaving(true);

    const result = await onSubmit({
      saleNumber,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
    });

    setSaving(false);
    if (!result.ok) setError(result.message ?? "No se pudo guardar.");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="font-display text-2xl uppercase">Número {saleNumber}</p>

      <label htmlFor="buyer-name" className="text-sm font-semibold">
        Nombre de quien compró
      </label>
      <input
        id="buyer-name"
        required
        value={buyerName}
        onChange={(event) => setBuyerName(event.target.value)}
        className="min-h-[44px] rounded-xl border border-border bg-card px-4 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <label htmlFor="buyer-phone" className="text-sm font-semibold">
        Teléfono (opcional)
      </label>
      <input
        id="buyer-phone"
        type="tel"
        inputMode="tel"
        value={buyerPhone}
        onChange={(event) => setBuyerPhone(event.target.value)}
        className="min-h-[44px] rounded-xl border border-border bg-card px-4 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {error && (
        <p role="alert" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] flex-1 touch-manipulation rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {saving ? "Guardando…" : "Guardar venta"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] touch-manipulation rounded-xl border border-border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
