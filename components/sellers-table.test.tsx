import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SellersTable, type AdminSellerRow } from "./sellers-table";

const soleAdmin: AdminSellerRow = {
  id: "a",
  displayName: "Ana",
  email: "ana@test.local",
  isAdmin: true,
  hasSales: false,
  hasLoggedIn: true,
};

const withSales: AdminSellerRow = {
  id: "b",
  displayName: "Bea",
  email: "bea@test.local",
  isAdmin: false,
  hasSales: true,
  hasLoggedIn: true,
};

const neverLoggedIn: AdminSellerRow = {
  id: "c",
  displayName: "Carla",
  email: "carla@test.local",
  isAdmin: false,
  hasSales: false,
  hasLoggedIn: false,
};

function renderTable(rows: AdminSellerRow[]) {
  render(<SellersTable rows={rows} onToggleAdmin={vi.fn()} onRemove={vi.fn()} />);
}

describe("SellersTable", () => {
  it("flags who never logged in, on her own row", () => {
    renderTable([soleAdmin, neverLoggedIn]);

    const carla = screen.getByRole("listitem", { name: /Carla/ });
    expect(within(carla).getByText("Nunca ingresó")).toBeInTheDocument();

    const ana = screen.getByRole("listitem", { name: /Ana/ });
    expect(within(ana).queryByText("Nunca ingresó")).toBeNull();
  });

  it("disables removing a seller with sales", () => {
    renderTable([soleAdmin, withSales]);
    expect(screen.getByRole("button", { name: "Dar de baja a Bea" })).toBeDisabled();
  });

  it("disables removing the last admin", () => {
    renderTable([soleAdmin, withSales]);
    expect(screen.getByRole("button", { name: "Dar de baja a Ana" })).toBeDisabled();
  });

  it("disables revoking the last admin", () => {
    renderTable([soleAdmin, withSales]);
    expect(screen.getByRole("button", { name: "Sacar admin a Ana" })).toBeDisabled();
  });

  it("enables removing a seller with no sales when another admin remains", () => {
    renderTable([soleAdmin, neverLoggedIn]);
    expect(screen.getByRole("button", { name: "Dar de baja a Carla" })).toBeEnabled();
  });
});
