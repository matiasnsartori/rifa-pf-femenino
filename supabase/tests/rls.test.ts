import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

if (!anonKey || !serviceKey) {
  throw new Error(
    'Faltan las claves locales. Exportalas con: eval "$(supabase status -o env | sed \'s/^/export /\')"',
  );
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const PASSWORD = "rls-test-password";
const SEED_ADMIN_EMAILS = [
  "sartorinmatias@gmail.com",
  "sartori828@hotmail.com",
  "sartoridbz@gmail.com",
];
const createdUserIds: string[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  createdUserIds.push(created.data.user.id);

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signedIn.error) throw signedIn.error;
  return client;
}

async function resetData() {
  await admin.from("sales").delete().gte("number", 1);
  await admin.from("sellers").update({ is_admin: true }).in("email", SEED_ADMIN_EMAILS);
  await admin.from("sellers").delete().like("email", "%@test.local");
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
}

async function makeSoleAdmin(sellerId: string) {
  await admin.from("sellers").update({ is_admin: false }).neq("id", sellerId);
}

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

beforeEach(resetData);
afterAll(resetData);

describe("public exposure", () => {
  it("does not let anon delete through the public view", async () => {
    const seller = await admin
      .from("sellers")
      .insert({ email: unique("ana"), display_name: "Ana", is_admin: false })
      .select()
      .single();
    await admin
      .from("sales")
      .insert({ number: 99, buyer_name: "Compradora", seller_id: seller.data!.id });

    await anon.from("public_numbers").delete().eq("number", 99);

    const { data } = await admin.from("sales").select("number").eq("number", 99);
    expect(data).toHaveLength(1);
  });

  it("lets anon read the numbers view", async () => {
    const seller = await admin
      .from("sellers")
      .insert({ email: unique("ana"), display_name: "Ana", is_admin: true })
      .select()
      .single();
    await admin.from("sales").insert({
      number: 42,
      buyer_name: "Compradora",
      buyer_phone: "123",
      seller_id: seller.data!.id,
    });

    const { data, error } = await anon.from("public_numbers").select("number");
    expect(error).toBeNull();
    expect(data).toEqual([{ number: 42 }]);
  });

  it("does not let anon read the sales table", async () => {
    const seller = await admin
      .from("sellers")
      .insert({ email: unique("ana"), display_name: "Ana" })
      .select()
      .single();
    await admin.from("sales").insert({
      number: 3,
      buyer_name: "Dato Personal",
      buyer_phone: "1155667788",
      seller_id: seller.data!.id,
    });

    const { data, error } = await anon.from("sales").select("buyer_name");

    expect(data ?? []).toEqual([]);
    expect(error === null || error.code === "42501").toBe(true);

    const { data: stillThere } = await admin.from("sales").select("buyer_name").eq("number", 3);
    expect(stillThere).toHaveLength(1);
  });
});

describe("allowlist", () => {
  it("links user_id on first login for a pre authorized email", async () => {
    const email = unique("bea");
    await admin.from("sellers").insert({ email, display_name: "Bea" });

    const client = await signInAs(email);
    const { data: user } = await client.auth.getUser();

    const { data: row } = await admin.from("sellers").select("user_id").eq("email", email).single();
    expect(row?.user_id).toBe(user.user?.id);
  });

  it("hides sales from an authenticated user outside the allowlist", async () => {
    const owner = await admin
      .from("sellers")
      .insert({ email: unique("ana"), display_name: "Ana" })
      .select()
      .single();
    await admin
      .from("sales")
      .insert({ number: 7, buyer_name: "Compradora", seller_id: owner.data!.id });

    const intruder = await signInAs(unique("intrusa"));
    const { data } = await intruder.from("sales").select("buyer_name");
    expect(data ?? []).toEqual([]);
  });
});

describe("sales policies", () => {
  it("lets a seller insert a sale for herself", async () => {
    const email = unique("carla");
    const seller = await admin
      .from("sellers")
      .insert({ email, display_name: "Carla" })
      .select()
      .single();
    const client = await signInAs(email);

    const { error } = await client
      .from("sales")
      .insert({ number: 10, buyer_name: "Compradora", seller_id: seller.data!.id });
    expect(error).toBeNull();
  });

  it("blocks inserting a sale under another seller id", async () => {
    const otherSeller = await admin
      .from("sellers")
      .insert({ email: unique("otra"), display_name: "Otra" })
      .select()
      .single();
    const email = unique("carla");
    await admin.from("sellers").insert({ email, display_name: "Carla" });
    const client = await signInAs(email);

    const { error } = await client
      .from("sales")
      .insert({ number: 11, buyer_name: "Compradora", seller_id: otherSeller.data!.id });
    expect(error?.code).toBe("42501");
  });

  it("rejects a duplicated number with a unique violation", async () => {
    const email = unique("carla");
    const seller = await admin
      .from("sellers")
      .insert({ email, display_name: "Carla" })
      .select()
      .single();
    const client = await signInAs(email);

    await client
      .from("sales")
      .insert({ number: 47, buyer_name: "Primera", seller_id: seller.data!.id });
    const { error } = await client
      .from("sales")
      .insert({ number: 47, buyer_name: "Segunda", seller_id: seller.data!.id });

    expect(error?.code).toBe("23505");
  });

  it("lets an admin edit a sale from another seller", async () => {
    const otherSeller = await admin
      .from("sellers")
      .insert({ email: unique("otra"), display_name: "Otra" })
      .select()
      .single();
    await admin
      .from("sales")
      .insert({ number: 20, buyer_name: "Original", seller_id: otherSeller.data!.id });

    const adminEmail = unique("jefa");
    await admin.from("sellers").insert({ email: adminEmail, display_name: "Jefa", is_admin: true });
    const client = await signInAs(adminEmail);

    const { error } = await client
      .from("sales")
      .update({ buyer_name: "Corregido" })
      .eq("number", 20);
    expect(error).toBeNull();
  });
});

describe("privilege escalation", () => {
  it("blocks a plain seller from making herself admin", async () => {
    const email = unique("carla");
    const seller = await admin
      .from("sellers")
      .insert({ email, display_name: "Carla" })
      .select()
      .single();
    const client = await signInAs(email);

    await client.from("sellers").update({ is_admin: true }).eq("id", seller.data!.id);

    const { data } = await admin.from("sellers").select("is_admin").eq("id", seller.data!.id).single();
    expect(data?.is_admin).toBe(false);
  });

  it("blocks demoting the last admin", async () => {
    const email = unique("jefa");
    const soleAdmin = await admin
      .from("sellers")
      .insert({ email, display_name: "Jefa", is_admin: true })
      .select()
      .single();
    await makeSoleAdmin(soleAdmin.data!.id);
    const client = await signInAs(email);

    const { error } = await client
      .from("sellers")
      .update({ is_admin: false })
      .eq("id", soleAdmin.data!.id);
    expect(error).not.toBeNull();

    const { data } = await admin.from("sellers").select("is_admin").eq("id", soleAdmin.data!.id).single();
    expect(data?.is_admin).toBe(true);
  });

  it("blocks deleting the last admin", async () => {
    const email = unique("jefa");
    const soleAdmin = await admin
      .from("sellers")
      .insert({ email, display_name: "Jefa", is_admin: true })
      .select()
      .single();
    await makeSoleAdmin(soleAdmin.data!.id);
    const client = await signInAs(email);

    await client.from("sellers").delete().eq("id", soleAdmin.data!.id);

    const { data } = await admin.from("sellers").select("id").eq("id", soleAdmin.data!.id);
    expect(data).toHaveLength(1);
  });
});
