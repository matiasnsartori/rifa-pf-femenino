"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Cambiar entre tema claro y oscuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-border bg-card text-xl text-card-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden="true" className="inline dark:hidden">🌙</span>
      <span aria-hidden="true" className="hidden dark:inline">☀️</span>
    </button>
  );
}
