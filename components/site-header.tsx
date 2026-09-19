import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import type { CurrentSeller } from "@/lib/session";

export function SiteHeader({ seller }: { seller: CurrentSeller | null }) {
  return (
    <header className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3">
      <Link href="/" className="font-display text-xl uppercase tracking-wide">
        Rifa PF
      </Link>
      <nav className="flex items-center gap-2">
        {seller && (
          <>
            <Link
              href="/panel"
              className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Panel
            </Link>
            <Link
              href="/contaduria"
              className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Números
            </Link>
          </>
        )}
        {seller?.isAdmin && (
          <Link
            href="/admin"
            className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Vendedoras
          </Link>
        )}
        <ThemeToggle />
      </nav>
    </header>
  );
}
