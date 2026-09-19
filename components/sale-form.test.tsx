import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaleForm } from "./sale-form";

describe("SaleForm", () => {
  it("shows the number being sold", () => {
    render(<SaleForm saleNumber={47} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/47/)).toBeInTheDocument();
  });

  it("submits the trimmed buyer data", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<SaleForm saleNumber={47} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Nombre de quien compró"), "  Lucía  ");
    await userEvent.type(screen.getByLabelText("Teléfono (opcional)"), "1155667788");
    await userEvent.click(screen.getByRole("button", { name: "Guardar venta" }));

    expect(onSubmit).toHaveBeenCalledWith({
      saleNumber: 47,
      buyerName: "Lucía",
      buyerPhone: "1155667788",
    });
  });

  it("shows the error message returned by the action", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: "El 47 ya está vendido." });
    render(<SaleForm saleNumber={47} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Nombre de quien compró"), "Lucía");
    await userEvent.click(screen.getByRole("button", { name: "Guardar venta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El 47 ya está vendido.");
  });

  it("does not submit without a buyer name", async () => {
    const onSubmit = vi.fn();
    render(<SaleForm saleNumber={47} onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar venta" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit a whitespace only buyer name", async () => {
    const onSubmit = vi.fn();
    render(<SaleForm saleNumber={47} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Nombre de quien compró"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Guardar venta" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cargá el nombre");
  });
});
