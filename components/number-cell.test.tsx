import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NumberCell } from "./number-cell";

describe("NumberCell", () => {
  it("announces a free number", () => {
    render(<NumberCell value={7} sold={false} />);
    expect(screen.getByRole("button", { name: "Número 7, libre" })).toBeInTheDocument();
  });

  it("announces a sold number", () => {
    render(<NumberCell value={7} sold />);
    expect(screen.getByRole("button", { name: "Número 7, vendido" })).toBeInTheDocument();
  });

  it("shows the number as text", () => {
    render(<NumberCell value={123} sold={false} />);
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("calls onSelect with its value", async () => {
    const onSelect = vi.fn();
    render(<NumberCell value={9} sold={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(9);
  });

  it("is disabled when there is no handler", () => {
    render(<NumberCell value={9} sold={false} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
