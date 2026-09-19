import { PRICE_PER_NUMBER, TOTAL_NUMBERS } from "./raffle";

export interface SaleRecord {
  number: number;
  sellerId: string;
}

export interface SellerRef {
  id: string;
  displayName: string;
}

export interface SellerTotal {
  sellerId: string;
  displayName: string;
  count: number;
  amount: number;
  numbers: number[];
}

export interface AccountingSummary {
  bySeller: SellerTotal[];
  soldCount: number;
  freeCount: number;
  collected: number;
  pending: number;
}

export function summarize(sellers: SellerRef[], sales: SaleRecord[]): AccountingSummary {
  const numbersBySeller = new Map<string, number[]>(sellers.map((seller) => [seller.id, []]));

  for (const sale of sales) {
    numbersBySeller.get(sale.sellerId)?.push(sale.number);
  }

  const bySeller = sellers
    .map((seller) => {
      const numbers = [...(numbersBySeller.get(seller.id) ?? [])].sort((a, b) => a - b);
      return {
        sellerId: seller.id,
        displayName: seller.displayName,
        count: numbers.length,
        amount: numbers.length * PRICE_PER_NUMBER,
        numbers,
      };
    })
    .sort((a, b) => b.amount - a.amount || a.displayName.localeCompare(b.displayName, "es"));

  const soldCount = sales.length;

  return {
    bySeller,
    soldCount,
    freeCount: TOTAL_NUMBERS - soldCount,
    collected: soldCount * PRICE_PER_NUMBER,
    pending: (TOTAL_NUMBERS - soldCount) * PRICE_PER_NUMBER,
  };
}
