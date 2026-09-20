import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginCta } from "./login-cta";

describe("LoginCta", () => {
  it("links to /login when there is no session", () => {
    render(<LoginCta signedIn={false} />);
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/login");
  });

  it("renders nothing when a seller is signed in", () => {
    render(<LoginCta signedIn />);
    expect(screen.queryByRole("link", { name: "Ingresar" })).not.toBeInTheDocument();
  });
});
