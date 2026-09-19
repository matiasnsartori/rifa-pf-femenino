import type { AccountingSummary } from "@/lib/accounting";
import { formatARS } from "@/lib/money";

export function AccountingTable({ summary }: { summary: AccountingSummary }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Ventas y montos por vendedora</caption>
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Vendedora</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Vendidos</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Monto</th>
            <th scope="col" className="px-4 py-3 font-semibold">Números</th>
          </tr>
        </thead>
        <tbody>
          {summary.bySeller.map((row) => (
            <tr key={row.sellerId} className="border-b border-border last:border-0">
              <th scope="row" className="px-4 py-3 font-semibold">{row.displayName}</th>
              <td className="px-4 py-3 text-right tabular-nums">{row.count}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatARS(row.amount)}</td>
              <td className="px-4 py-3 text-muted-foreground tabular-nums">
                {row.numbers.length > 0 ? row.numbers.join(", ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
