"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SellersTable, type AdminSellerRow } from "@/components/sellers-table";
import { addSeller, removeSeller, setAdmin } from "@/app/actions/sellers";

export function AdminBoard({ rows }: { rows: AdminSellerRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addSeller({ email, displayName });
    setMessage(result.ok ? null : (result.message ?? "No se pudo agregar."));
    if (result.ok) {
      setEmail("");
      setDisplayName("");
      router.refresh();
    }
  }

  async function toggleAdmin(row: AdminSellerRow) {
    const result = await setAdmin(row.id, !row.isAdmin);
    setMessage(result.ok ? null : (result.message ?? null));
    router.refresh();
  }

  async function remove(row: AdminSellerRow) {
    if (!window.confirm(`¿Dar de baja a ${row.displayName}?`)) return;
    const result = await removeSeller(row.id);
    setMessage(result.ok ? null : (result.message ?? null));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <label htmlFor="new-name" className="text-sm font-semibold">Nombre</label>
        <input
          id="new-name"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-background px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label htmlFor="new-email" className="text-sm font-semibold">Email</label>
        <input
          id="new-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-background px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Agregar vendedora
        </button>
      </form>

      {message && (
        <p role="alert" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <SellersTable rows={rows} onToggleAdmin={toggleAdmin} onRemove={remove} />
    </div>
  );
}
