import { describe, expect, it } from "vitest";
import { summarize } from "./accounting";
import { PRICE_PER_NUMBER, TOTAL_NUMBERS } from "./raffle";

const sellers = [
  { id: "a", displayName: "Ana" },
  { id: "b", displayName: "Beatriz" },
  { id: "c", displayName: "Carla" },
];

describe("summarize", () => {
  it("returns zeros when nothing was sold", () => {
    const result = summarize(sellers, []);
    expect(result.soldCount).toBe(0);
    expect(result.freeCount).toBe(TOTAL_NUMBERS);
    expect(result.collected).toBe(0);
    expect(result.pending).toBe(TOTAL_NUMBERS * PRICE_PER_NUMBER);
  });

  it("includes sellers with no sales", () => {
    const result = summarize(sellers, [{ number: 1, sellerId: "a" }]);
    expect(result.bySeller).toHaveLength(3);
    const carla = result.bySeller.find((row) => row.sellerId === "c");
    expect(carla?.count).toBe(0);
    expect(carla?.amount).toBe(0);
    expect(carla?.numbers).toEqual([]);
  });

  it("adds up counts and amounts per seller", () => {
    const result = summarize(sellers, [
      { number: 1, sellerId: "a" },
      { number: 2, sellerId: "a" },
      { number: 3, sellerId: "b" },
    ]);
    const ana = result.bySeller.find((row) => row.sellerId === "a");
    expect(ana?.count).toBe(2);
    expect(ana?.amount).toBe(2 * PRICE_PER_NUMBER);
    expect(result.collected).toBe(3 * PRICE_PER_NUMBER);
    expect(result.soldCount).toBe(3);
    expect(result.freeCount).toBe(TOTAL_NUMBERS - 3);
  });

  it("sorts by amount descending, then by name", () => {
    const result = summarize(sellers, [
      { number: 3, sellerId: "b" },
      { number: 1, sellerId: "a" },
      { number: 2, sellerId: "a" },
    ]);
    expect(result.bySeller.map((row) => row.sellerId)).toEqual(["a", "b", "c"]);
  });

  it("keeps each seller numbers sorted ascending", () => {
    const result = summarize(sellers, [
      { number: 30, sellerId: "a" },
      { number: 4, sellerId: "a" },
      { number: 17, sellerId: "a" },
    ]);
    expect(result.bySeller[0].numbers).toEqual([4, 17, 30]);
  });

  it("ignores sales whose seller is unknown", () => {
    const result = summarize(sellers, [{ number: 1, sellerId: "ghost" }]);
    expect(result.bySeller.every((row) => row.count === 0)).toBe(true);
    expect(result.soldCount).toBe(1);
  });

  it("keeps collected plus pending equal to the full raffle", () => {
    const result = summarize(sellers, [
      { number: 1, sellerId: "a" },
      { number: 2, sellerId: "b" },
    ]);
    expect(result.collected + result.pending).toBe(TOTAL_NUMBERS * PRICE_PER_NUMBER);
  });
});
