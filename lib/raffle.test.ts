import { describe, expect, it } from "vitest";
import { TOTAL_NUMBERS, allNumbers, freeNumbers, isValidNumber } from "./raffle";

describe("isValidNumber", () => {
  it("accepts the boundaries of the range", () => {
    expect(isValidNumber(1)).toBe(true);
    expect(isValidNumber(TOTAL_NUMBERS)).toBe(true);
  });

  it("rejects values outside the range", () => {
    expect(isValidNumber(0)).toBe(false);
    expect(isValidNumber(TOTAL_NUMBERS + 1)).toBe(false);
    expect(isValidNumber(-3)).toBe(false);
  });

  it("rejects non integers", () => {
    expect(isValidNumber(7.5)).toBe(false);
    expect(isValidNumber(Number.NaN)).toBe(false);
  });
});

describe("allNumbers", () => {
  it("returns every number from 1 to the total", () => {
    const all = allNumbers();
    expect(all).toHaveLength(TOTAL_NUMBERS);
    expect(all[0]).toBe(1);
    expect(all.at(-1)).toBe(TOTAL_NUMBERS);
  });
});

describe("freeNumbers", () => {
  it("returns every number when nothing was sold", () => {
    expect(freeNumbers([])).toHaveLength(TOTAL_NUMBERS);
  });

  it("removes the sold ones", () => {
    const free = freeNumbers([1, 5, TOTAL_NUMBERS]);
    expect(free).toHaveLength(TOTAL_NUMBERS - 3);
    expect(free).not.toContain(1);
    expect(free).not.toContain(5);
    expect(free).not.toContain(TOTAL_NUMBERS);
    expect(free).toContain(2);
  });

  it("ignores duplicates in the sold list", () => {
    expect(freeNumbers([7, 7, 7])).toHaveLength(TOTAL_NUMBERS - 1);
  });
});
