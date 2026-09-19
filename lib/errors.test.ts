import { describe, expect, it } from "vitest";
import { toSaleError } from "./errors";

describe("toSaleError", () => {
  it("returns null when there is no error", () => {
    expect(toSaleError(null, 47)).toBeNull();
  });

  it("maps a unique violation to a taken number", () => {
    const result = toSaleError({ code: "23505" }, 47);
    expect(result?.kind).toBe("number-taken");
    expect(result?.message).toContain("47");
  });

  it("maps an rls denial to not allowed", () => {
    const result = toSaleError({ code: "42501" }, 47);
    expect(result?.kind).toBe("not-allowed");
  });

  it("maps a check violation to invalid", () => {
    expect(toSaleError({ code: "23514" }, 999)?.kind).toBe("invalid");
  });

  it("maps a foreign key violation to invalid", () => {
    expect(toSaleError({ code: "23503" }, 47)?.kind).toBe("invalid");
  });

  it("falls back to unknown for anything else", () => {
    const result = toSaleError({ code: "08006" }, 47);
    expect(result?.kind).toBe("unknown");
    expect(result?.message.length).toBeGreaterThan(0);
  });

  it("falls back to unknown when there is no code", () => {
    expect(toSaleError({ message: "boom" }, 47)?.kind).toBe("unknown");
  });
});
