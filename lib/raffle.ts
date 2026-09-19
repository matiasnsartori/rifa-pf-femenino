export const TOTAL_NUMBERS = 200;
export const PRICE_PER_NUMBER = 10000;

export function isValidNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= TOTAL_NUMBERS;
}

export function allNumbers(): number[] {
  return Array.from({ length: TOTAL_NUMBERS }, (_, index) => index + 1);
}

export function freeNumbers(sold: number[]): number[] {
  const taken = new Set(sold);
  return allNumbers().filter((value) => !taken.has(value));
}
