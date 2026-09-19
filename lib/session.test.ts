import { describe, expect, it, vi } from "vitest";
import { getCurrentSeller } from "./session";

const { createServerSupabase } = vi.hoisted(() => ({ createServerSupabase: vi.fn() }));

vi.mock("./supabase/server", () => ({ createServerSupabase }));

function mockSupabase(options: {
  user: { id: string } | null;
  sellerRow: { id: string; display_name: string; is_admin: boolean } | null;
  sellerError: { message: string } | null;
}) {
  createServerSupabase.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: options.sellerRow, error: options.sellerError }),
        }),
      }),
    }),
  });
}

describe("getCurrentSeller", () => {
  it("returns not-seller when there is no authenticated user", async () => {
    mockSupabase({ user: null, sellerRow: null, sellerError: null });

    expect(await getCurrentSeller()).toEqual({ status: "not-seller" });
  });

  it("returns unavailable when the sellers query fails", async () => {
    mockSupabase({
      user: { id: "u1" },
      sellerRow: null,
      sellerError: { message: "connection lost" },
    });

    expect(await getCurrentSeller()).toEqual({ status: "unavailable" });
  });

  it("returns not-seller when there is no matching row", async () => {
    mockSupabase({ user: { id: "u1" }, sellerRow: null, sellerError: null });

    expect(await getCurrentSeller()).toEqual({ status: "not-seller" });
  });

  it("returns the mapped seller when a row matches", async () => {
    mockSupabase({
      user: { id: "u1" },
      sellerRow: { id: "s1", display_name: "Carla", is_admin: true },
      sellerError: null,
    });

    expect(await getCurrentSeller()).toEqual({
      status: "seller",
      seller: { id: "s1", displayName: "Carla", isAdmin: true },
    });
  });
});
