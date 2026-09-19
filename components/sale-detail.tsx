"use client";

export interface PanelSale {
  number: number;
  buyerName: string;
  buyerPhone: string | null;
  sellerId: string;
  sellerName: string;
  soldAt: string;
}

interface SaleDetailProps {
  sale: PanelSale;
  canEdit: boolean;
  onEdit: () => void;
  onRelease: () => void;
  onClose: () => void;
}

export function SaleDetail({ sale, canEdit, onEdit, onRelease, onClose }: SaleDetailProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-2xl uppercase">Número {sale.number}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Compró</dt>
        <dd className="font-semibold">{sale.buyerName}</dd>
        <dt className="text-muted-foreground">Teléfono</dt>
        <dd>{sale.buyerPhone ?? "—"}</dd>
        <dt className="text-muted-foreground">Vendió</dt>
        <dd>{sale.sellerName}</dd>
        <dt className="text-muted-foreground">Fecha</dt>
        <dd>{new Date(sale.soldAt).toLocaleString("es-AR")}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onRelease}
              className="min-h-[44px] touch-manipulation rounded-xl border border-border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Liberar número
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] touch-manipulation rounded-xl border border-border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
