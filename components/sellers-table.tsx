"use client";

import { canRemoveSeller, canRevokeAdmin, type SellerRow } from "@/lib/sellers";

export interface AdminSellerRow extends SellerRow {
  email: string;
  hasLoggedIn: boolean;
}

interface SellersTableProps {
  rows: AdminSellerRow[];
  onToggleAdmin: (row: AdminSellerRow) => void;
  onRemove: (row: AdminSellerRow) => void;
}

const ACTION_CLASS =
  "min-h-[44px] touch-manipulation rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SellersTable({ rows, onToggleAdmin, onRemove }: SellersTableProps) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const removal = canRemoveSeller(row, rows);
        const revocation = row.isAdmin ? canRevokeAdmin(row, rows) : { allowed: true as const };
        const blocked = removal.allowed ? null : removal.reason;

        return (
          <li
            key={row.id}
            aria-label={row.displayName}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-card-foreground"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-semibold">{row.displayName}</span>
              <span className="text-sm text-muted-foreground">{row.email}</span>
              {row.isAdmin && (
                <span className="rounded-lg bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                  Admin
                </span>
              )}
              {!row.hasLoggedIn && (
                <span className="text-xs text-muted-foreground">Nunca ingresó</span>
              )}
            </div>

            {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!revocation.allowed}
                onClick={() => onToggleAdmin(row)}
                aria-label={`${row.isAdmin ? "Sacar" : "Hacer"} admin a ${row.displayName}`}
                className={ACTION_CLASS}
              >
                {row.isAdmin ? "Sacar admin" : "Hacer admin"}
              </button>
              <button
                type="button"
                disabled={!removal.allowed}
                onClick={() => onRemove(row)}
                aria-label={`Dar de baja a ${row.displayName}`}
                className={ACTION_CLASS}
              >
                Dar de baja
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
