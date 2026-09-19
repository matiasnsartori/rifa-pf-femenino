"use client";

export interface NumberCellProps {
  value: number;
  sold: boolean;
  onSelect?: (value: number) => void;
}

const FREE = "border-free/60 bg-card text-free";
const SOLD = "border-sold/40 bg-muted text-sold line-through";

export function NumberCell({ value, sold, onSelect }: NumberCellProps) {
  return (
    <button
      type="button"
      disabled={!onSelect}
      aria-label={`Número ${value}, ${sold ? "vendido" : "libre"}`}
      onClick={() => onSelect?.(value)}
      className={`flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl border-2 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${sold ? SOLD : FREE}`}
    >
      {value}
    </button>
  );
}
