import { describe, expect, it } from "vitest";
import { canRemoveSeller, canRevokeAdmin, type SellerRow } from "./sellers";

const admin: SellerRow = { id: "a", displayName: "Ana", isAdmin: true, hasSales: false };
const otherAdmin: SellerRow = { id: "b", displayName: "Bea", isAdmin: true, hasSales: false };
const plain: SellerRow = { id: "c", displayName: "Carla", isAdmin: false, hasSales: false };
const withSales: SellerRow = { id: "d", displayName: "Dana", isAdmin: false, hasSales: true };

describe("canRemoveSeller", () => {
  it("allows removing a seller with no sales", () => {
    expect(canRemoveSeller(plain, [admin, plain])).toEqual({ allowed: true });
  });

  it("blocks removing a seller that has sales", () => {
    const result = canRemoveSeller(withSales, [admin, withSales]);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.reason).toContain("ventas");
  });

  it("blocks removing the last admin", () => {
    const result = canRemoveSeller(admin, [admin, plain]);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.reason).toContain("admin");
  });

  it("allows removing an admin when another admin remains", () => {
    expect(canRemoveSeller(admin, [admin, otherAdmin])).toEqual({ allowed: true });
  });

  it("checks sales before the last admin rule", () => {
    const soleAdminWithSales = { ...admin, hasSales: true };
    const result = canRemoveSeller(soleAdminWithSales, [soleAdminWithSales, plain]);
    expect(result.allowed === false && result.reason).toContain("ventas");
  });
});

describe("canRevokeAdmin", () => {
  it("allows revoking when another admin remains", () => {
    expect(canRevokeAdmin(admin, [admin, otherAdmin])).toEqual({ allowed: true });
  });

  it("blocks revoking the last admin", () => {
    const result = canRevokeAdmin(admin, [admin, plain]);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.reason).toContain("admin");
  });

  it("allows revoking someone who is not an admin", () => {
    expect(canRevokeAdmin(plain, [admin, plain])).toEqual({ allowed: true });
  });
});
