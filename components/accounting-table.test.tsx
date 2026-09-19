import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountingTable } from "./accounting-table";
import { summarize } from "@/lib/accounting";

const sellers = [
  { id: "a", displayName: "Ana" },
  { id: "b", displayName: "Beatriz" },
];

describe("AccountingTable", () => {
  it("renders one row per seller", () => {
    const summary = summarize(sellers, [{ number: 1, sellerId: "a" }]);
    render(<AccountingTable summary={summary} />);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Beatriz")).toBeInTheDocument();
  });

  it("shows the numbers sold by each seller", () => {
    const summary = summarize(sellers, [
      { number: 4, sellerId: "a" },
      { number: 9, sellerId: "a" },
    ]);
    render(<AccountingTable summary={summary} />);
    expect(screen.getByText("4, 9")).toBeInTheDocument();
  });

  it("shows a dash in the row of a seller with no sales", () => {
    const summary = summarize(sellers, [{ number: 1, sellerId: "a" }]);
    render(<AccountingTable summary={summary} />);

    const beatriz = screen.getByRole("row", { name: /Beatriz/ });
    expect(within(beatriz).getByText("—")).toBeInTheDocument();

    const ana = screen.getByRole("row", { name: /Ana/ });
    expect(within(ana).queryByText("—")).toBeNull();
  });
});
