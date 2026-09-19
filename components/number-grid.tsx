"use client";

import { allNumbers } from "@/lib/raffle";
import { NumberCell } from "./number-cell";

export interface NumberGridProps {
  soldNumbers: number[];
  numbers?: number[];
  onSelect?: (value: number) => void;
}

export function NumberGrid({ soldNumbers, numbers, onSelect }: NumberGridProps) {
  const sold = new Set(soldNumbers);
  const visible = numbers ?? allNumbers();

  return (
    <div
      role="group"
      aria-label="Números de la rifa"
      className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10"
    >
      {visible.map((value) => (
        <NumberCell key={value} value={value} sold={sold.has(value)} onSelect={onSelect} />
      ))}
    </div>
  );
}
