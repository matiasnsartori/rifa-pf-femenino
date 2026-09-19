import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NumberGrid } from "./number-grid";
import { TOTAL_NUMBERS } from "@/lib/raffle";

describe("NumberGrid", () => {
  it("renders every number of the raffle", () => {
    render(<NumberGrid soldNumbers={[]} />);
    expect(screen.getAllByRole("button")).toHaveLength(TOTAL_NUMBERS);
  });

  it("marks only the sold ones", () => {
    render(<NumberGrid soldNumbers={[1, 200]} />);
    expect(screen.getByRole("button", { name: "Número 1, vendido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Número 200, vendido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Número 2, libre" })).toBeInTheDocument();
  });

  it("renders only the given subset when numbers is passed", () => {
    render(<NumberGrid soldNumbers={[]} numbers={[3, 8]} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Número 3, libre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Número 8, libre" })).toBeInTheDocument();
  });

  it("labels the grid as a group for assistive tech", () => {
    render(<NumberGrid soldNumbers={[]} numbers={[1]} />);
    expect(screen.getByRole("group", { name: "Números de la rifa" })).toBeInTheDocument();
  });
});
