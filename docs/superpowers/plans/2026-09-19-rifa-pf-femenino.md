# Rifa PF Femenino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app (PWA) donde un grupo de vendedoras registra la venta de una rifa de 200 números, sin poder vender dos veces el mismo, con la contaduría de lo recaudado.

**Architecture:** Next 16 App Router sobre Supabase. La unicidad del número la garantiza la PRIMARY KEY de `sales`, no el cliente. La sincronización entre dispositivos es Supabase Realtime. La autorización es RLS basada en una allowlist por email (`sellers`), no en el rol `authenticated`.

**Tech Stack:** Next 16.3.5, React 19.2.8, Tailwind 4, TypeScript 5, `@supabase/ssr`, `next-themes`, Vitest 5, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-09-19-rifa-pf-femenino-design.md`

## Global Constraints

- **Next 16: el archivo es `proxy.ts`, NO `middleware.ts`.** El convention `middleware.js` está deprecado en Next 16 y renombrado a `proxy.js`. La función se exporta como `proxy`. Un `middleware.ts` no se ejecuta.
- **Next 16: las Request APIs son async.** `cookies()` y `headers()` se usan siempre con `await`.
- Turbopack es el default en Next 16. Los scripts `dev` y `build` lo usan explícitamente.
- `next lint` fue removido en Next 16. El script `lint` corre `eslint` directo, con flat config.
- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nomenclatura nueva de Supabase; NO `ANON_KEY`).
- **Idioma:** identificadores, nombres de archivo y comentarios en **inglés**. Todo el texto visible por el usuario, en **español**.
- **Comentarios:** prohibidos los bloques de comentario multilínea. Una línea cuando se gana el lugar. Si algo necesita explicación, se arregla el nombre o se extrae una función.
- **Accesibilidad:** todo control interactivo mínimo 44x44px, `focus-visible` con `ring`, contraste WCAG AA (4.5:1 texto normal, 3:1 texto grande y bordes). Libre/vendido nunca se distinguen solo por color.
- **Commits:** mensajes de hasta 8 palabras, conventional commits, sin atribución de IA.
- **Nunca hacer `git push` sin pedirlo explícitamente.** Todos los commits quedan locales hasta que el usuario lo autorice.
- Total de números: 200. Rango válido: 1..200.
- La cantidad de vendedoras es variable. Ningún número de vendedoras aparece cableado en el código.

## File Structure

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/raffle.ts` | Constantes e invariantes del dominio (total, precio, rango válido, números libres) |
| `lib/errors.ts` | Traduce códigos de error de Postgres a mensajes de UI |
| `lib/accounting.ts` | Cálculo puro de la contaduría a partir de ventas y vendedoras |
| `lib/sellers.ts` | Reglas puras de baja y de último admin |
| `lib/supabase/client.ts` | Cliente de browser |
| `lib/supabase/server.ts` | Cliente de Server Component / Server Action |
| `lib/supabase/proxy.ts` | Refresco de sesión para `proxy.ts` |
| `proxy.ts` | Entry point de Next 16 que refresca la sesión |
| `supabase/migrations/0001_init.sql` | Tablas, vista, funciones, triggers, RLS, Realtime |
| `supabase/migrations/0002_seed_admin.sql` | Primer admin (huevo y gallina) |
| `supabase/tests/rls.test.ts` | Tests de las policies contra Supabase local |
| `app/layout.tsx` | Fuentes, tema, metadata |
| `app/manifest.ts` | Web App Manifest (PWA) |
| `app/page.tsx` | Grilla pública |
| `app/login/page.tsx` | Magic link |
| `app/auth/callback/route.ts` | Intercambio del código por sesión |
| `app/panel/page.tsx` | Operación con Realtime |
| `app/contaduria/page.tsx` | Números |
| `app/admin/page.tsx` | Allowlist |
| `app/actions/sales.ts` | Server Actions de ventas |
| `app/actions/sellers.ts` | Server Actions de allowlist |
| `components/number-grid.tsx` | Grilla presentacional, sin fetch |
| `components/number-cell.tsx` | Celda presentacional |
| `components/sale-form.tsx` | Alta de venta |
| `components/sale-detail.tsx` | Detalle de venta |
| `components/accounting-table.tsx` | Tabla de contaduría |
| `components/sellers-table.tsx` | Tabla de allowlist |
| `components/theme-toggle.tsx` | Switch light/dark |
| `components/install-app.tsx` | Prompt de instalación PWA |

Los componentes de `components/` reciben datos por props y no hablan con Supabase. Eso los hace testeables sin base.

---

### Task 1: Toolchain de tests y dominio de la rifa

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/raffle.ts`
- Create: `lib/raffle.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada.
- Produces: `TOTAL_NUMBERS: number`, `PRICE_PER_NUMBER: number`, `isValidNumber(n: number): boolean`, `allNumbers(): number[]`, `freeNumbers(sold: number[]): number[]`.

- [ ] **Step 1: Instalar Vitest y crear su configuración**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Crear `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules/**", ".next/**", "supabase/tests/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Crear `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

En `package.json`, agregar a `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

Y cambiar `dev` y `build` para que usen Turbopack explícitamente:

```json
"dev": "next dev --turbopack",
"build": "next build --turbopack"
```

- [ ] **Step 3: Escribir el test que falla**

Crear `lib/raffle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TOTAL_NUMBERS, allNumbers, freeNumbers, isValidNumber } from "./raffle";

describe("isValidNumber", () => {
  it("accepts the boundaries of the range", () => {
    expect(isValidNumber(1)).toBe(true);
    expect(isValidNumber(TOTAL_NUMBERS)).toBe(true);
  });

  it("rejects values outside the range", () => {
    expect(isValidNumber(0)).toBe(false);
    expect(isValidNumber(TOTAL_NUMBERS + 1)).toBe(false);
    expect(isValidNumber(-3)).toBe(false);
  });

  it("rejects non integers", () => {
    expect(isValidNumber(7.5)).toBe(false);
    expect(isValidNumber(Number.NaN)).toBe(false);
  });
});

describe("allNumbers", () => {
  it("returns every number from 1 to the total", () => {
    const all = allNumbers();
    expect(all).toHaveLength(TOTAL_NUMBERS);
    expect(all[0]).toBe(1);
    expect(all.at(-1)).toBe(TOTAL_NUMBERS);
  });
});

describe("freeNumbers", () => {
  it("returns every number when nothing was sold", () => {
    expect(freeNumbers([])).toHaveLength(TOTAL_NUMBERS);
  });

  it("removes the sold ones", () => {
    const free = freeNumbers([1, 5, TOTAL_NUMBERS]);
    expect(free).toHaveLength(TOTAL_NUMBERS - 3);
    expect(free).not.toContain(1);
    expect(free).not.toContain(5);
    expect(free).not.toContain(TOTAL_NUMBERS);
    expect(free).toContain(2);
  });

  it("ignores duplicates in the sold list", () => {
    expect(freeNumbers([7, 7, 7])).toHaveLength(TOTAL_NUMBERS - 1);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -- lib/raffle.test.ts`
Expected: FAIL — `Failed to resolve import "./raffle"`.

- [ ] **Step 4: Escribir la implementación mínima**

Crear `lib/raffle.ts`:

```ts
export const TOTAL_NUMBERS = 200;
export const PRICE_PER_NUMBER = 10000;

export function isValidNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= TOTAL_NUMBERS;
}

export function allNumbers(): number[] {
  return Array.from({ length: TOTAL_NUMBERS }, (_, index) => index + 1);
}

export function freeNumbers(sold: number[]): number[] {
  const taken = new Set(sold);
  return allNumbers().filter((value) => !taken.has(value));
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -- lib/raffle.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json package-lock.json lib/raffle.ts lib/raffle.test.ts
git commit -m "feat: dominio de la rifa con tests"
```

---

### Task 2: Traducción de errores de Postgres

**Files:**
- Create: `lib/errors.ts`
- Create: `lib/errors.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type SaleErrorKind = "number-taken" | "not-allowed" | "invalid" | "unknown"`, `interface SaleError { kind: SaleErrorKind; message: string }`, `toSaleError(error: PostgrestLikeError | null, saleNumber: number): SaleError | null`, `interface PostgrestLikeError { code?: string | null; message?: string | null }`.

Este es el camino de error central de la app: cuando dos vendedoras marcan el mismo número, la segunda recibe el código `23505` de Postgres. Ese error no es una falla, es la base cumpliendo su función.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/errors.test.ts`:

```ts
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- lib/errors.test.ts`
Expected: FAIL — `Failed to resolve import "./errors"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/errors.ts`:

```ts
export type SaleErrorKind = "number-taken" | "not-allowed" | "invalid" | "unknown";

export interface SaleError {
  kind: SaleErrorKind;
  message: string;
}

export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

export function toSaleError(
  error: PostgrestLikeError | null,
  saleNumber: number,
): SaleError | null {
  if (!error) return null;

  switch (error.code) {
    case UNIQUE_VIOLATION:
      return {
        kind: "number-taken",
        message: `El ${saleNumber} ya está vendido. Actualizá la grilla y elegí otro.`,
      };
    case INSUFFICIENT_PRIVILEGE:
      return {
        kind: "not-allowed",
        message: "No tenés permiso para hacer esto.",
      };
    case CHECK_VIOLATION:
    case FOREIGN_KEY_VIOLATION:
      return {
        kind: "invalid",
        message: "Los datos cargados no son válidos. Revisá el número y el nombre.",
      };
    default:
      return {
        kind: "unknown",
        message: "No se pudo guardar. Probá de nuevo en un momento.",
      };
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- lib/errors.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/errors.ts lib/errors.test.ts
git commit -m "feat: traduccion de errores de postgres"
```

---

### Task 3: Cálculo de la contaduría

**Files:**
- Create: `lib/accounting.ts`
- Create: `lib/accounting.test.ts`

**Interfaces:**
- Consumes: `TOTAL_NUMBERS`, `PRICE_PER_NUMBER` de `lib/raffle.ts`.
- Produces: `interface SaleRecord { number: number; sellerId: string }`, `interface SellerRef { id: string; displayName: string }`, `interface SellerTotal { sellerId: string; displayName: string; count: number; amount: number; numbers: number[] }`, `interface AccountingSummary { bySeller: SellerTotal[]; soldCount: number; freeCount: number; collected: number; pending: number }`, `summarize(sellers: SellerRef[], sales: SaleRecord[]): AccountingSummary`.

Acá se cuenta plata. Un error se discute entre personas, así que los casos borde van todos cubiertos.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/accounting.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarize } from "./accounting";
import { PRICE_PER_NUMBER, TOTAL_NUMBERS } from "./raffle";

const sellers = [
  { id: "a", displayName: "Ana" },
  { id: "b", displayName: "Beatriz" },
  { id: "c", displayName: "Carla" },
];

describe("summarize", () => {
  it("returns zeros when nothing was sold", () => {
    const result = summarize(sellers, []);
    expect(result.soldCount).toBe(0);
    expect(result.freeCount).toBe(TOTAL_NUMBERS);
    expect(result.collected).toBe(0);
    expect(result.pending).toBe(TOTAL_NUMBERS * PRICE_PER_NUMBER);
  });

  it("includes sellers with no sales", () => {
    const result = summarize(sellers, [{ number: 1, sellerId: "a" }]);
    expect(result.bySeller).toHaveLength(3);
    const carla = result.bySeller.find((row) => row.sellerId === "c");
    expect(carla?.count).toBe(0);
    expect(carla?.amount).toBe(0);
    expect(carla?.numbers).toEqual([]);
  });

  it("adds up counts and amounts per seller", () => {
    const result = summarize(sellers, [
      { number: 1, sellerId: "a" },
      { number: 2, sellerId: "a" },
      { number: 3, sellerId: "b" },
    ]);
    const ana = result.bySeller.find((row) => row.sellerId === "a");
    expect(ana?.count).toBe(2);
    expect(ana?.amount).toBe(2 * PRICE_PER_NUMBER);
    expect(result.collected).toBe(3 * PRICE_PER_NUMBER);
    expect(result.soldCount).toBe(3);
    expect(result.freeCount).toBe(TOTAL_NUMBERS - 3);
  });

  it("sorts by amount descending, then by name", () => {
    const result = summarize(sellers, [
      { number: 3, sellerId: "b" },
      { number: 1, sellerId: "a" },
      { number: 2, sellerId: "a" },
    ]);
    expect(result.bySeller.map((row) => row.sellerId)).toEqual(["a", "b", "c"]);
  });

  it("keeps each seller numbers sorted ascending", () => {
    const result = summarize(sellers, [
      { number: 30, sellerId: "a" },
      { number: 4, sellerId: "a" },
      { number: 17, sellerId: "a" },
    ]);
    expect(result.bySeller[0].numbers).toEqual([4, 17, 30]);
  });

  it("ignores sales whose seller is unknown", () => {
    const result = summarize(sellers, [{ number: 1, sellerId: "ghost" }]);
    expect(result.bySeller.every((row) => row.count === 0)).toBe(true);
    expect(result.soldCount).toBe(1);
  });

  it("keeps collected plus pending equal to the full raffle", () => {
    const result = summarize(sellers, [
      { number: 1, sellerId: "a" },
      { number: 2, sellerId: "b" },
    ]);
    expect(result.collected + result.pending).toBe(TOTAL_NUMBERS * PRICE_PER_NUMBER);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- lib/accounting.test.ts`
Expected: FAIL — `Failed to resolve import "./accounting"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/accounting.ts`:

```ts
import { PRICE_PER_NUMBER, TOTAL_NUMBERS } from "./raffle";

export interface SaleRecord {
  number: number;
  sellerId: string;
}

export interface SellerRef {
  id: string;
  displayName: string;
}

export interface SellerTotal {
  sellerId: string;
  displayName: string;
  count: number;
  amount: number;
  numbers: number[];
}

export interface AccountingSummary {
  bySeller: SellerTotal[];
  soldCount: number;
  freeCount: number;
  collected: number;
  pending: number;
}

export function summarize(sellers: SellerRef[], sales: SaleRecord[]): AccountingSummary {
  const numbersBySeller = new Map<string, number[]>(sellers.map((seller) => [seller.id, []]));

  for (const sale of sales) {
    numbersBySeller.get(sale.sellerId)?.push(sale.number);
  }

  const bySeller = sellers
    .map((seller) => {
      const numbers = [...(numbersBySeller.get(seller.id) ?? [])].sort((a, b) => a - b);
      return {
        sellerId: seller.id,
        displayName: seller.displayName,
        count: numbers.length,
        amount: numbers.length * PRICE_PER_NUMBER,
        numbers,
      };
    })
    .sort((a, b) => b.amount - a.amount || a.displayName.localeCompare(b.displayName, "es"));

  const soldCount = sales.length;

  return {
    bySeller,
    soldCount,
    freeCount: TOTAL_NUMBERS - soldCount,
    collected: soldCount * PRICE_PER_NUMBER,
    pending: (TOTAL_NUMBERS - soldCount) * PRICE_PER_NUMBER,
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- lib/accounting.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/accounting.ts lib/accounting.test.ts
git commit -m "feat: calculo de la contaduria"
```

---

### Task 4: Reglas de baja y de último admin

**Files:**
- Create: `lib/sellers.ts`
- Create: `lib/sellers.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `interface SellerRow { id: string; displayName: string; isAdmin: boolean; hasSales: boolean }`, `type Guard = { allowed: true } | { allowed: false; reason: string }`, `canRemoveSeller(target: SellerRow, all: SellerRow[]): Guard`, `canRevokeAdmin(target: SellerRow, all: SellerRow[]): Guard`.

Estas reglas también viven en la base (Task 5). Acá se duplican a propósito, para poder deshabilitar el botón y mostrar el motivo antes de pegarle al servidor. La base es la que manda; esto es solo anticipación.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/sellers.test.ts`:

```ts
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- lib/sellers.test.ts`
Expected: FAIL — `Failed to resolve import "./sellers"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/sellers.ts`:

```ts
export interface SellerRow {
  id: string;
  displayName: string;
  isAdmin: boolean;
  hasSales: boolean;
}

export type Guard = { allowed: true } | { allowed: false; reason: string };

const ALLOWED: Guard = { allowed: true };

function isLastAdmin(target: SellerRow, all: SellerRow[]): boolean {
  if (!target.isAdmin) return false;
  return all.filter((row) => row.isAdmin && row.id !== target.id).length === 0;
}

export function canRemoveSeller(target: SellerRow, all: SellerRow[]): Guard {
  if (target.hasSales) {
    return {
      allowed: false,
      reason: "Tiene ventas cargadas. Borrarla dejaría esas ventas sin dueño.",
    };
  }
  if (isLastAdmin(target, all)) {
    return { allowed: false, reason: "Es la única admin. Nombrá otra antes de darla de baja." };
  }
  return ALLOWED;
}

export function canRevokeAdmin(target: SellerRow, all: SellerRow[]): Guard {
  if (isLastAdmin(target, all)) {
    return { allowed: false, reason: "Es la única admin. Nombrá otra antes de sacarle el rol." };
  }
  return ALLOWED;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- lib/sellers.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/sellers.ts lib/sellers.test.ts
git commit -m "feat: reglas de baja y ultimo admin"
```

---

### Task 5: Esquema de base, funciones, triggers y RLS

**Files:**
- Create: `supabase/config.toml` (lo genera `supabase init`)
- Create: `supabase/migrations/0001_init.sql`
- Create: `supabase/migrations/0002_seed_admin.sql`

**Interfaces:**
- Consumes: nada.
- Produces: tablas `public.sellers` y `public.sales`, vista `public.public_numbers`, funciones `public.current_seller_id() returns uuid`, `public.is_seller() returns boolean`, `public.is_raffle_admin() returns boolean`.

Nota de nombres: la función se llama `is_raffle_admin()`, **no** `is_admin()`. Dentro de una policy sobre `sellers`, el identificador `is_admin` se resuelve primero como la columna de la tabla, no como la función. Ese choque es silencioso y da permisos mal evaluados.

Nota sobre los `revoke`: Supabase concede por default (`pg_default_acl`) permisos completos de CRUD a `anon` y `authenticated` sobre **cada relación nueva** del esquema `public`, incluidas las vistas. Un `grant select` encima de eso no restringe nada: es un no-op sobre un permiso más amplio que ya existe. Y `public_numbers` es una vista de una sola tabla sin joins ni agregados, así que Postgres la trata como **actualizable y borrable automáticamente**; con `security_invoker = off` ese DML corre como el dueño de la vista (`postgres`, que tiene `rolbypassrls`). Sin el `revoke` explícito, cualquiera con la anon key —que viaja en el cliente— puede `DELETE FROM public_numbers` y borrar ventas salteándose RLS por completo. El `revoke` no es defensa en profundidad: es lo único que cierra ese agujero.

Nota sobre el email: se guarda como `text` normalizado en minúsculas y sin espacios, con un trigger que lo fuerza y un índice único. No se usa `citext` para no depender de una extensión.

- [ ] **Step 1: Inicializar Supabase local**

```bash
brew install supabase/tap/supabase
supabase init
supabase start
```

`supabase start` imprime la URL, la `anon key` y la `service_role key` locales. Guardalas: se usan en la Task 6.

- [ ] **Step 2: Escribir la migración inicial**

Crear `supabase/migrations/0001_init.sql`:

```sql
create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null check (length(trim(display_name)) > 0),
  is_admin boolean not null default false,
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index sellers_email_key on public.sellers (email);

create table public.sales (
  number smallint primary key check (number between 1 and 200),
  buyer_name text not null check (length(trim(buyer_name)) > 0),
  buyer_phone text,
  seller_id uuid not null references public.sellers (id) on delete restrict,
  sold_at timestamptz not null default now()
);

create index sales_seller_id_idx on public.sales (seller_id);

create function public.normalize_seller_email() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

create trigger sellers_normalize_email
  before insert or update of email on public.sellers
  for each row execute function public.normalize_seller_email();

create function public.link_seller_account() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sellers
     set user_id = new.id
   where email = lower(trim(new.email))
     and user_id is null;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_seller_account();

create function public.guard_last_admin() returns trigger
language plpgsql
set search_path = public
as $$
declare
  remaining integer;
begin
  if tg_op = 'UPDATE' and (not old.is_admin or new.is_admin) then
    return new;
  end if;

  if tg_op = 'DELETE' and not old.is_admin then
    return old;
  end if;

  select count(*) into remaining
    from public.sellers
   where is_admin and id <> old.id;

  if remaining = 0 then
    raise exception 'no se puede dejar la rifa sin admins'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger sellers_guard_last_admin
  before update or delete on public.sellers
  for each row execute function public.guard_last_admin();

create function public.current_seller_id() returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.sellers where user_id = auth.uid();
$$;

create function public.is_seller() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_seller_id() is not null;
$$;

create function public.is_raffle_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sellers where user_id = auth.uid() and is_admin
  );
$$;

alter table public.sellers enable row level security;
alter table public.sales enable row level security;

create policy "sellers_select" on public.sellers
  for select to authenticated
  using (public.is_seller());

create policy "sellers_admin_insert" on public.sellers
  for insert to authenticated
  with check (public.is_raffle_admin());

create policy "sellers_admin_update" on public.sellers
  for update to authenticated
  using (public.is_raffle_admin())
  with check (public.is_raffle_admin());

create policy "sellers_admin_delete" on public.sellers
  for delete to authenticated
  using (public.is_raffle_admin());

create policy "sales_select" on public.sales
  for select to authenticated
  using (public.is_seller());

create policy "sales_insert_own" on public.sales
  for insert to authenticated
  with check (seller_id = public.current_seller_id());

create policy "sales_update_own_or_admin" on public.sales
  for update to authenticated
  using (seller_id = public.current_seller_id() or public.is_raffle_admin())
  with check (seller_id = public.current_seller_id() or public.is_raffle_admin());

create policy "sales_delete_own_or_admin" on public.sales
  for delete to authenticated
  using (seller_id = public.current_seller_id() or public.is_raffle_admin());

create view public.public_numbers
with (security_invoker = off)
as select number from public.sales;

revoke all on public.public_numbers from anon, authenticated;
grant select on public.public_numbers to anon, authenticated;

revoke all on public.sellers from anon;
revoke all on public.sales from anon;

alter publication supabase_realtime add table public.sales;
```

- [ ] **Step 3: Escribir el seed del primer admin**

El primer admin no puede crearse desde la app: sin admin no hay quien use `/admin`. Va una vez, acá.

Crear `supabase/migrations/0002_seed_admin.sql`:

```sql
insert into public.sellers (email, display_name, is_admin)
values
  ('sartorinmatias@gmail.com', 'Matías', true),
  ('sartori828@hotmail.com', 'Sartori', true),
  ('sartoridbz@gmail.com', 'Sartori DBZ', true)
on conflict (email) do update set is_admin = true;
```

Los mails van en minúscula: el trigger `sellers_normalize_email` los bajaría igual, pero el índice único es sobre el valor guardado y la fuente se lee mejor consistente.

- [ ] **Step 4: Aplicar las migraciones y verificar**

Run: `supabase db reset`
Expected: aplica `0001` y `0002` sin error, y termina con `Finished supabase db reset.`

Verificar que la vista no filtra datos personales:

Run: `supabase db reset && psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "\d+ public.public_numbers"`
Expected: la vista tiene exactamente una columna, `number`.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/migrations/0001_init.sql supabase/migrations/0002_seed_admin.sql
git commit -m "feat: esquema con rls y allowlist por email"
```

---

### Task 6: Tests de RLS contra Supabase local

**Files:**
- Create: `vitest.rls.config.ts`
- Create: `supabase/tests/rls.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: el esquema de la Task 5.
- Produces: nada que consuma otra task.

Las policies son seguridad, no una convención. Un test que no las ejercite no está cubriendo nada: RLS no se puede verificar leyendo el SQL, porque el bug típico es una policy que *existe* y *no aplica*.

- [ ] **Step 1: Actualizar el seed con los tres admins**

El seed de la Task 5 tenía un solo admin. El usuario confirmó tres. Reemplazar el contenido de `supabase/migrations/0002_seed_admin.sql`:

```sql
insert into public.sellers (email, display_name, is_admin)
values
  ('sartorinmatias@gmail.com', 'Matías', true),
  ('sartori828@hotmail.com', 'Sartori', true),
  ('sartoridbz@gmail.com', 'Sartori DBZ', true)
on conflict (email) do update set is_admin = true;
```

Aplicar con `supabase db reset` y verificar:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select email, is_admin from public.sellers order by email;"
```

Expected: tres filas, las tres con `is_admin = t` y el email en minúscula.

- [ ] **Step 2: Crear la configuración de tests de integración**

Crear `vitest.rls.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
```

En `package.json`, agregar a `scripts`:

```json
"test:rls": "vitest run --config vitest.rls.config.ts"
```

- [ ] **Step 2: Escribir el test que falla**

Dos detalles que parecen menores y no lo son. **Cada test que asegura que alguien NO puede ver algo tiene que crear ese algo primero**: asertar sobre una tabla vacía pasa aunque la tabla esté completamente abierta, y ese test no puede fallar nunca. Y **el mensaje de error del propio archivo tiene que dar un comando que funcione**: `supabase status -o env` emite `API_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`, no los nombres con prefijo `SUPABASE_`, así que el test acepta ambos.

`resetData()` no puede borrar todas las vendedoras: el trigger `guard_last_admin` aborta el statement al quedar cero admins, y entonces no borra ninguna. Por eso restaura primero a **todos** los admins del seed y después borra solo los emails `@test.local`. Y como esos admins siempre existen, un admin de test nunca sería "el último" por sí solo: `makeSoleAdmin()` degrada al resto para que los dos tests de último-admin ejerciten el trigger de verdad.

Crear `supabase/tests/rls.test.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

function requireEnv(...candidates: (string | undefined)[]): string {
  const value = candidates.find(Boolean);
  if (!value) {
    throw new Error(
      'Faltan las claves locales. Exportalas con: eval "$(supabase status -o env | sed \'s/^/export /\')"',
    );
  }
  return value;
}

const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
const anonKey = requireEnv(process.env.SUPABASE_ANON_KEY, process.env.ANON_KEY);
const serviceKey = requireEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SERVICE_ROLE_KEY);

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
```

- [ ] **Step 4: Correr el test y verificar que falla**

```bash
npm install @supabase/supabase-js @supabase/ssr
supabase start
eval "$(supabase status -o env | sed 's/^/export /')"
npm run test:rls
```

Expected: FAIL. Si el esquema de la Task 5 está bien aplicado los tests ya pasan; si alguno falla, el problema está en la migración, no en el test. Corregir `0001_init.sql` y correr `supabase db reset`.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `supabase db reset && npm run test:rls && npm run typecheck`
Expected: PASS, 12 tests, y `tsc --noEmit` sin errores.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_seed_admin.sql vitest.rls.config.ts supabase/tests/rls.test.ts package.json package-lock.json
git commit -m "test: policies de rls contra supabase local"
```

---

### Task 7: Sesión, proxy y login por magic link

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/proxy.ts`
- Create: `proxy.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/login-form.tsx`
- Create: `app/auth/callback/route.ts`
- Create: `lib/session.ts`
- Create: `.env.local`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada.
- Produces: `createBrowserSupabase()` de `lib/supabase/client.ts`, `createServerSupabase()` de `lib/supabase/server.ts`, `getCurrentSeller(): Promise<CurrentSeller | null>` y `interface CurrentSeller { id: string; displayName: string; isAdmin: boolean }` de `lib/session.ts`.

**En Next 16 el archivo es `proxy.ts`, no `middleware.ts`.** Un `middleware.ts` no se ejecuta y la sesión nunca se refresca: el usuario se desloguea solo al rato y el bug es dificilísimo de rastrear.

- [ ] **Step 1: Configurar el entorno**

Crear `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Crear `.env.local` con los valores locales que imprimió `supabase start` (`API URL` y `anon key`).

El `.gitignore` de create-next-app trae `.env*`, que también tapa `.env.example` y haría fallar su `git add`. Agregar a `.gitignore`:

```
!.env.example
.atl/
supabase/.branches
supabase/.temp
```

- [ ] **Step 2: Escribir los clientes de Supabase**

Crear `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

Crear `lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component: cookies are refreshed by the proxy.
          }
        },
      },
    },
  );
}
```

Crear `lib/supabase/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function refreshSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}
```

- [ ] **Step 3: Escribir el proxy de Next 16**

Crear `proxy.ts` en la raíz del proyecto:

```ts
import type { NextRequest } from "next/server";
import { refreshSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)",
};
```

- [ ] **Step 4: Escribir el helper de sesión**

Crear `lib/session.ts`:

```ts
import { createServerSupabase } from "./supabase/server";

export interface CurrentSeller {
  id: string;
  displayName: string;
  isAdmin: boolean;
}

export async function getCurrentSeller(): Promise<CurrentSeller | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("sellers")
    .select("id, display_name, is_admin")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, displayName: data.display_name, isAdmin: data.is_admin };
}
```

- [ ] **Step 5: Escribir el login y el callback**

Crear `app/login/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <p className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
        Te mandamos un link a <strong>{email}</strong>. Abrilo desde este mismo celular.
      </p>
    );
  }

  return (
    <form onSubmit={send} className="flex w-full flex-col gap-3">
      <label htmlFor="email" className="text-sm font-semibold">
        Tu email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="min-h-[44px] rounded-xl border border-border bg-card px-4 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {status === "sending" ? "Enviando…" : "Enviarme el link"}
      </button>
      {status === "error" && (
        <p role="alert" className="text-sm text-muted-foreground">
          No se pudo enviar el link. Revisá el email y probá de nuevo.
        </p>
      )}
    </form>
  );
}
```

Crear `app/login/page.tsx`:

```tsx
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl uppercase tracking-wide">Ingresar</h1>
      <p className="text-muted-foreground">
        Te mandamos un link de acceso por email. No hay contraseña.
      </p>
      <LoginForm />
    </main>
  );
}
```

Crear `app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const target = new URL(code ? "/panel" : "/login", request.nextUrl.origin);

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) target.pathname = "/login";
  }

  return NextResponse.redirect(target);
}
```

- [ ] **Step 6: Verificar el flujo de login a mano**

```bash
npm run dev
```

Abrir `http://localhost:3000/login`, ingresar `sartorinmatias@gmail.com` (uno de los admins del seed), y abrir `http://127.0.0.1:54324` (Inbucket, el buzón local de Supabase) para hacer click en el link.

Expected: redirige a `/panel`. Verificar que el trigger ató la cuenta:

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "select email, user_id is not null as linked from public.sellers;"
```

Expected: `linked` en `t`.

- [ ] **Step 7: Verificar que el proxy corre**

Agregar temporalmente `console.log("proxy ok")` como primera línea de `proxy()`, recargar cualquier página y confirmar que aparece en la consola de `next dev`. Borrar el `console.log`.

Expected: aparece. Si no aparece, el archivo está mal ubicado o mal nombrado (tiene que ser `proxy.ts` en la raíz, al mismo nivel que `app/`).

- [ ] **Step 8: Commit**

```bash
git add lib/supabase lib/session.ts proxy.ts app/login app/auth .env.example .gitignore
git commit -m "feat: sesion con proxy y login magic link"
```

---

### Task 8: Tokens de diseño, layout, tema y PWA

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `app/manifest.ts`
- Create: `components/theme-toggle.tsx`
- Create: `components/install-app.tsx`
- Create: `components/site-header.tsx`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`

**Interfaces:**
- Consumes: nada.
- Produces: clases de Tailwind derivadas de los tokens (`bg-background`, `text-foreground`, `bg-card`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `ring-ring`, `text-free`, `text-sold`, `font-display`, `font-body`), y los componentes `<ThemeToggle />`, `<InstallApp />`, `<SiteHeader seller={...} />`.

Misma arquitectura que `torneo-playfutbol`: tokens semánticos en CSS vars, proyectados a Tailwind con `@theme inline`. Paleta propia.

- [ ] **Step 1: Instalar `next-themes`**

```bash
npm install next-themes
```

- [ ] **Step 2: Escribir los tokens**

Reemplazar el contenido completo de `app/globals.css`:

Los valores de `--border` y del `--sold` oscuro están calculados, no elegidos a ojo. Un borde que
delimita un control interactivo necesita 3:1 contra su fondo (WCAG 1.4.11) y los valores suaves
que parecen elegantes en una maqueta rondan 1.5:1. En una grilla de 200 celdas leída al sol en un
celular, el borde no es decoración: es lo que separa un número de otro.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: hsl(340 40% 97%);
  --foreground: hsl(330 30% 12%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(330 30% 12%);
  --primary: hsl(336 72% 34%);
  --primary-foreground: hsl(340 40% 98%);
  --accent: hsl(41 92% 44%);
  --accent-foreground: hsl(330 30% 12%);
  --muted: hsl(340 20% 92%);
  --muted-foreground: hsl(330 12% 34%);
  --border: hsl(336 18% 55%);
  --ring: hsl(336 72% 34%);
  --free: hsl(158 64% 26%);
  --sold: hsl(330 10% 40%);

  --font-display-active: var(--font-anton);
  --font-body-active: var(--font-archivo);
}

.dark {
  --background: hsl(330 24% 7%);
  --foreground: hsl(340 30% 94%);
  --card: hsl(330 20% 11%);
  --card-foreground: hsl(340 30% 94%);
  --primary: hsl(336 86% 68%);
  --primary-foreground: hsl(330 40% 8%);
  --accent: hsl(44 92% 62%);
  --accent-foreground: hsl(330 40% 8%);
  --muted: hsl(330 14% 16%);
  --muted-foreground: hsl(335 10% 72%);
  --border: hsl(332 14% 43%);
  --ring: hsl(336 86% 68%);
  --free: hsl(152 60% 58%);
  --sold: hsl(335 8% 53%);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --color-free: var(--free);
  --color-sold: var(--sold);
  --font-display: var(--font-display-active);
  --font-body: var(--font-body-active);
}

body {
  background-color: var(--background);
  background-image: radial-gradient(
    circle at 50% -15%,
    color-mix(in srgb, var(--primary) 16%, transparent),
    transparent 60%
  );
  background-repeat: no-repeat;
  color: var(--foreground);
  font-family: var(--font-body);
  min-height: 100dvh;
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(1rem) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-rise {
  animation: rise-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .animate-rise {
    animation: none;
  }
  * {
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Escribir el layout con fuentes y tema**

Reemplazar `app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Anton, Archivo } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Rifa PF Femenino",
  description: "Qué números quedan libres y cuánto lleva vendido cada una.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf1f5" },
    { media: "(prefers-color-scheme: dark)", color: "#160e12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${anton.variable} ${archivo.variable}`}>
      <body className="font-body antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Escribir el manifest y generar los íconos**

Crear `app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rifa PF Femenino",
    short_name: "Rifa PF",
    description: "Qué números quedan libres y cuánto lleva vendido cada una.",
    start_url: "/",
    display: "standalone",
    background_color: "#160e12",
    theme_color: "#160e12",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

Generar los tres íconos desde un cuadrado sólido con el número de la rifa. Si hay logo del club, usarlo en su lugar.

```bash
mkdir -p public/icons
magick -size 512x512 xc:'#95194a' -gravity center -pointsize 240 -fill '#fbf1f5' \
  -annotate 0 'R' public/icons/icon-512.png
magick public/icons/icon-512.png -resize 192x192 public/icons/icon-192.png
magick -size 512x512 xc:'#95194a' -gravity center -pointsize 170 -fill '#fbf1f5' \
  -annotate 0 'R' public/icons/maskable-512.png
```

El `maskable` usa tipografía más chica porque Android recorta hasta un 20% de cada borde.

Si `magick` no está: `brew install imagemagick`.

- [ ] **Step 5: Escribir los componentes de chrome**

Crear `components/theme-toggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      aria-label="Cambiar entre tema claro y oscuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-border bg-card text-xl text-card-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden="true">{mounted ? (resolvedTheme === "dark" ? "☀️" : "🌙") : "·"}</span>
    </button>
  );
}
```

Crear `components/install-app.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "rifa-pf:install-dismissed";

export function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    const ios =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (ios) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setShow(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferred(null);
  }

  if (!show) return null;

  return (
    <div className="animate-rise flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <span aria-hidden="true" className="text-2xl">📲</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">Instalá la app en el celu</p>
        {isIOS && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tocá Compartir y después “Agregar a inicio”.
          </p>
        )}
      </div>
      {!isIOS && (
        <button
          type="button"
          onClick={install}
          className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Instalar
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="No mostrar más"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
```

Crear `components/site-header.tsx`:

```tsx
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import type { CurrentSeller } from "@/lib/session";

export function SiteHeader({ seller }: { seller: CurrentSeller | null }) {
  return (
    <header className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3">
      <Link href="/" className="font-display text-xl uppercase tracking-wide">
        Rifa PF
      </Link>
      <nav className="flex items-center gap-2">
        {seller && (
          <>
            <Link
              href="/panel"
              className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Panel
            </Link>
            <Link
              href="/contaduria"
              className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Números
            </Link>
          </>
        )}
        {seller?.isAdmin && (
          <Link
            href="/admin"
            className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Vendedoras
          </Link>
        )}
        <ThemeToggle />
      </nav>
    </header>
  );
}
```

- [ ] **Step 6: Verificar build y tema**

Run: `npm run build && npm run dev`
Expected: build sin errores. En `http://localhost:3000/login`, el toggle cambia light/dark y el fondo acompaña.

Verificar el manifest:

Run: `curl -s http://localhost:3000/manifest.webmanifest | head -5`
Expected: JSON con `"name": "Rifa PF Femenino"`.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css app/layout.tsx app/manifest.ts components public/icons package.json package-lock.json
git commit -m "feat: tokens de diseno tema y pwa"
```

---

### Task 9: Grilla de números y página pública

**Files:**
- Create: `components/number-cell.tsx`
- Create: `components/number-cell.test.tsx`
- Create: `components/number-grid.tsx`
- Create: `components/number-grid.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `TOTAL_NUMBERS`, `allNumbers()` de `lib/raffle.ts`; `<SiteHeader />`, `<InstallApp />`.
- Produces: `interface NumberCellProps { value: number; sold: boolean; onSelect?: (value: number) => void }`, `interface NumberGridProps { soldNumbers: number[]; numbers?: number[]; onSelect?: (value: number) => void }`.

Libre y vendido se distinguen por **color, borde y texto accesible**, nunca solo por color. Quien no distingue rojo de verde tiene que poder usar esto.

- [ ] **Step 1: Instalar `user-event` y escribir los tests que fallan**

```bash
npm install -D @testing-library/user-event
```

Crear `components/number-cell.test.tsx`:

```tsx
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
```

Crear `components/number-grid.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- components/`
Expected: FAIL — no se resuelven los imports de `./number-cell` y `./number-grid`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `components/number-cell.tsx`:

```tsx
"use client";

export interface NumberCellProps {
  value: number;
  sold: boolean;
  onSelect?: (value: number) => void;
}

const FREE = "border-free/60 bg-card text-free";
const SOLD = "border-sold/40 bg-muted text-sold line-through";

export function NumberCell({ value, sold, onSelect }: NumberCellProps) {
  return (
    <button
      type="button"
      disabled={!onSelect}
      aria-label={`Número ${value}, ${sold ? "vendido" : "libre"}`}
      onClick={() => onSelect?.(value)}
      className={`flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl border-2 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${sold ? SOLD : FREE}`}
    >
      {value}
    </button>
  );
}
```

Crear `components/number-grid.tsx`:

```tsx
"use client";

import { allNumbers } from "@/lib/raffle";
import { NumberCell } from "./number-cell";

export interface NumberGridProps {
  soldNumbers: number[];
  numbers?: number[];
  onSelect?: (value: number) => void;
}

export function NumberGrid({ soldNumbers, numbers, onSelect }: NumberGridProps) {
  const sold = new Set(soldNumbers);
  const visible = numbers ?? allNumbers();

  return (
    <div
      role="group"
      aria-label="Números de la rifa"
      className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10"
    >
      {visible.map((value) => (
        <NumberCell key={value} value={value} sold={sold.has(value)} onSelect={onSelect} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- components/`
Expected: PASS, 9 tests.

- [ ] **Step 5: Escribir la página pública**

Reemplazar `app/page.tsx`:

```tsx
import { NumberGrid } from "@/components/number-grid";
import { InstallApp } from "@/components/install-app";
import { SiteHeader } from "@/components/site-header";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { TOTAL_NUMBERS } from "@/lib/raffle";

export const revalidate = 10;

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("public_numbers").select("number");
  const soldNumbers = (data ?? []).map((row) => row.number);
  const seller = await getCurrentSeller();

  return (
    <>
      <SiteHeader seller={seller} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide">Rifa PF Femenino</h1>
          {!error && (
            <p className="mt-1 text-muted-foreground tabular-nums">
              {TOTAL_NUMBERS - soldNumbers.length} libres · {soldNumbers.length} vendidos
            </p>
          )}
        </div>
        <InstallApp />
        {error ? (
          <p role="alert" className="rounded-2xl border border-border bg-card p-4">
            No pudimos cargar los números. Actualizá la página antes de vender: sin esta
            información podés vender uno que ya está vendido.
          </p>
        ) : (
          <NumberGrid soldNumbers={soldNumbers} />
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 6: Verificar que la vista pública no filtra datos**

Run: `npm run dev`, abrir `http://localhost:3000` en una ventana privada (sin sesión).
Expected: se ve la grilla y el contador; no aparece ningún nombre ni teléfono.

Confirmar contra la API que `anon` no puede leer `sales`:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sales?select=buyer_name" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Expected: error `42501`, permiso denegado. Un `[]` también sería aceptable —significaría que RLS
filtró todas las filas— pero desde el `revoke` de la Task 5 `anon` no tiene ningún permiso sobre
`sales`, así que ni siquiera llega a evaluar policies. La garantía es más fuerte que la que pedía
esta verificación originalmente.

- [ ] **Step 7: Commit**

```bash
git add components/number-cell.tsx components/number-cell.test.tsx components/number-grid.tsx components/number-grid.test.tsx app/page.tsx package.json package-lock.json
git commit -m "feat: grilla de numeros y vista publica"
```

---

### Task 10: Panel de operación con Realtime

**Files:**
- Create: `app/actions/sales.ts`
- Create: `components/sale-form.tsx`
- Create: `components/sale-form.test.tsx`
- Create: `components/sale-detail.tsx`
- Create: `app/panel/panel-board.tsx`
- Create: `app/panel/page.tsx`

**Interfaces:**
- Consumes: `getCurrentSeller()`, `createServerSupabase()`, `createBrowserSupabase()`, `toSaleError()`, `isValidNumber()`, `allNumbers()`, `<NumberGrid />`, `<SiteHeader />`.
- Produces: `interface ActionResult { ok: boolean; message?: string }`, `createSale(input: SaleInput): Promise<ActionResult>`, `updateSale(input: SaleInput): Promise<ActionResult>`, `releaseSale(saleNumber: number): Promise<ActionResult>`, `interface SaleInput { saleNumber: number; buyerName: string; buyerPhone: string }`, `interface PanelSale { number: number; buyerName: string; buyerPhone: string | null; sellerId: string; sellerName: string; soldAt: string }` (exportada desde `components/sale-detail.tsx`, que es quien la muestra).

- [ ] **Step 1: Escribir las Server Actions**

Crear `app/actions/sales.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { toSaleError } from "@/lib/errors";
import { isValidNumber } from "@/lib/raffle";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface SaleInput {
  saleNumber: number;
  buyerName: string;
  buyerPhone: string;
}

const NOT_A_SELLER: ActionResult = {
  ok: false,
  message: "Tu cuenta no está habilitada para cargar ventas.",
};

async function sellerWhoTook(saleNumber: number): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("sales")
    .select("sellers(display_name)")
    .eq("number", saleNumber)
    .maybeSingle();

  return (data?.sellers as unknown as { display_name: string } | null)?.display_name ?? null;
}

function refreshViews() {
  revalidatePath("/");
  revalidatePath("/panel");
  revalidatePath("/contaduria");
}

export async function createSale(input: SaleInput): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller) return NOT_A_SELLER;

  if (!isValidNumber(input.saleNumber)) {
    return { ok: false, message: "Ese número no existe en la rifa." };
  }
  if (!input.buyerName.trim()) {
    return { ok: false, message: "Cargá el nombre de quien compró." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("sales").insert({
    number: input.saleNumber,
    buyer_name: input.buyerName.trim(),
    buyer_phone: input.buyerPhone.trim() || null,
    seller_id: seller.id,
  });

  const saleError = toSaleError(error, input.saleNumber);
  if (saleError?.kind === "number-taken") {
    const takenBy = await sellerWhoTook(input.saleNumber);
    return {
      ok: false,
      message: takenBy
        ? `El ${input.saleNumber} lo acaba de vender ${takenBy}. Elegí otro.`
        : saleError.message,
    };
  }
  if (saleError) return { ok: false, message: saleError.message };

  refreshViews();
  return { ok: true };
}

export async function updateSale(input: SaleInput): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller) return NOT_A_SELLER;

  if (!input.buyerName.trim()) {
    return { ok: false, message: "Cargá el nombre de quien compró." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("sales")
    .update({
      buyer_name: input.buyerName.trim(),
      buyer_phone: input.buyerPhone.trim() || null,
    })
    .eq("number", input.saleNumber)
    .select("number");

  const saleError = toSaleError(error, input.saleNumber);
  if (saleError) return { ok: false, message: saleError.message };
  if (!data?.length) {
    return { ok: false, message: "No se pudo editar. Esa venta ya no es tuya o fue liberada." };
  }

  refreshViews();
  return { ok: true };
}

export async function releaseSale(saleNumber: number): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller) return NOT_A_SELLER;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("sales")
    .delete()
    .eq("number", saleNumber)
    .select("number");

  const saleError = toSaleError(error, saleNumber);
  if (saleError) return { ok: false, message: saleError.message };
  if (!data?.length) {
    return { ok: false, message: "No se pudo liberar. Esa venta ya no es tuya o fue liberada." };
  }

  refreshViews();
  return { ok: true };
}
```

El `.select("number")` encadenado en `updateSale` y `releaseSale` no es cosmético. Sin él, cuando
RLS filtra la fila, PostgREST no devuelve error: devuelve cero filas afectadas y la acción informa
éxito. La UI cerraría el panel como si hubiera funcionado. Contar las filas devueltas es la única
forma de distinguir "se hizo" de "no aplicó a nadie".

- [ ] **Step 2: Escribir el test que falla**

Crear `components/sale-form.test.tsx`:

```tsx
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
```

El test del nombre vacío se apoya en el atributo `required`, que jsdom respeta: **pasaría igual
aunque se borrara la guarda del componente**. La guarda existe para el caso que `required` no
cubre, un nombre de solo espacios, y ese es el que asserta el segundo test.

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -- components/sale-form.test.tsx`
Expected: FAIL — `Failed to resolve import "./sale-form"`.

- [ ] **Step 4: Escribir el formulario y el detalle**

Crear `components/sale-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ActionResult, SaleInput } from "@/app/actions/sales";

interface SaleFormProps {
  saleNumber: number;
  initialName?: string;
  initialPhone?: string;
  onSubmit: (input: SaleInput) => Promise<ActionResult>;
  onCancel: () => void;
}

export function SaleForm({
  saleNumber,
  initialName = "",
  initialPhone = "",
  onSubmit,
  onCancel,
}: SaleFormProps) {
  const [buyerName, setBuyerName] = useState(initialName);
  const [buyerPhone, setBuyerPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buyerName.trim()) {
      setError("Cargá el nombre de quien compró.");
      return;
    }
    setError(null);
    setSaving(true);

    const result = await onSubmit({
      saleNumber,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
    });

    setSaving(false);
    if (!result.ok) setError(result.message ?? "No se pudo guardar.");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="font-display text-2xl uppercase">Número {saleNumber}</p>

      <label htmlFor="buyer-name" className="text-sm font-semibold">
        Nombre de quien compró
      </label>
      <input
        id="buyer-name"
        required
        value={buyerName}
        onChange={(event) => setBuyerName(event.target.value)}
        className="min-h-[44px] rounded-xl border border-border bg-card px-4 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <label htmlFor="buyer-phone" className="text-sm font-semibold">
        Teléfono (opcional)
      </label>
      <input
        id="buyer-phone"
        type="tel"
        inputMode="tel"
        value={buyerPhone}
        onChange={(event) => setBuyerPhone(event.target.value)}
        className="min-h-[44px] rounded-xl border border-border bg-card px-4 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {error && (
        <p role="alert" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] flex-1 touch-manipulation rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {saving ? "Guardando…" : "Guardar venta"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] touch-manipulation rounded-xl border border-border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
```

Crear `components/sale-detail.tsx`:

```tsx
"use client";

export interface PanelSale {
  number: number;
  buyerName: string;
  buyerPhone: string | null;
  sellerId: string;
  sellerName: string;
  soldAt: string;
}

interface SaleDetailProps {
  sale: PanelSale;
  canEdit: boolean;
  onEdit: () => void;
  onRelease: () => void;
  onClose: () => void;
}

export function SaleDetail({ sale, canEdit, onEdit, onRelease, onClose }: SaleDetailProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-2xl uppercase">Número {sale.number}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Compró</dt>
        <dd className="font-semibold">{sale.buyerName}</dd>
        <dt className="text-muted-foreground">Teléfono</dt>
        <dd>{sale.buyerPhone ?? "—"}</dd>
        <dt className="text-muted-foreground">Vendió</dt>
        <dd>{sale.sellerName}</dd>
        <dt className="text-muted-foreground">Fecha</dt>
        <dd>{new Date(sale.soldAt).toLocaleString("es-AR")}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onRelease}
              className="min-h-[44px] touch-manipulation rounded-xl border border-border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Liberar número
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] touch-manipulation rounded-xl border border-border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -- components/sale-form.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Escribir el tablero con Realtime**

Crear `app/panel/panel-board.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NumberGrid } from "@/components/number-grid";
import { SaleDetail, type PanelSale } from "@/components/sale-detail";
import { SaleForm } from "@/components/sale-form";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { TOTAL_NUMBERS, allNumbers } from "@/lib/raffle";
import { createSale, releaseSale, updateSale } from "@/app/actions/sales";
import type { CurrentSeller } from "@/lib/session";

interface PanelBoardProps {
  sales: PanelSale[];
  seller: CurrentSeller;
}

type Mode = "detail" | "edit" | "create";

export function PanelBoard({ sales, seller }: PanelBoardProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("detail");
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected !== null) sheetRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("sales-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () =>
        router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const byNumber = new Map(sales.map((sale) => [sale.number, sale]));
  const current = selected === null ? null : (byNumber.get(selected) ?? null);

  const needle = query.trim().toLowerCase();
  const visibleNumbers = needle
    ? allNumbers().filter(
        (value) =>
          String(value).includes(needle) ||
          (byNumber.get(value)?.buyerName.toLowerCase().includes(needle) ?? false),
      )
    : undefined;

  function open(value: number) {
    setActionError(null);
    setSelected(value);
    setMode(byNumber.has(value) ? "detail" : "create");
  }

  function close() {
    setActionError(null);
    setSelected(null);
  }

  async function release() {
    if (selected === null) return;
    if (!window.confirm(`¿Liberar el número ${selected}? Se borra la venta.`)) return;

    const result = await releaseSale(selected);
    if (!result.ok) {
      setActionError(result.message ?? "No se pudo liberar el número.");
      return;
    }
    close();
  }

  return (
    <>
      <p className="text-muted-foreground tabular-nums">
        {TOTAL_NUMBERS - sales.length} libres · {sales.length} vendidos
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="search" className="text-sm font-semibold">
          Buscar por número o por quien compró
        </label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-card px-4 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {visibleNumbers?.length === 0 ? (
        <p className="text-muted-foreground">No hay números que coincidan con “{query}”.</p>
      ) : (
        <NumberGrid
          soldNumbers={sales.map((sale) => sale.number)}
          numbers={visibleNumbers}
          onSelect={open}
        />
      )}

      {selected !== null && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Número ${selected}`}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className="animate-rise fixed inset-x-0 bottom-0 z-10 rounded-t-3xl border-t border-border bg-card p-5 text-card-foreground shadow-2xl focus-visible:outline-none"
        >
          {actionError && (
            <p role="alert" className="mb-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              {actionError}
            </p>
          )}

          {mode !== "create" && !current && (
            <div className="flex flex-col gap-3">
              <p role="alert" className="text-sm">
                El número {selected} fue liberado mientras lo mirabas.
              </p>
              <button
                type="button"
                onClick={close}
                className="min-h-[44px] touch-manipulation rounded-xl border border-border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cerrar
              </button>
            </div>
          )}

          {mode === "create" && current && (
            <div className="flex flex-col gap-3">
              <p role="alert" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                Mientras cargabas, {current.sellerName} vendió el {current.number}. Elegí otro.
              </p>
              <SaleDetail
                sale={current}
                canEdit={seller.isAdmin || current.sellerId === seller.id}
                onEdit={() => setMode("edit")}
                onRelease={release}
                onClose={close}
              />
            </div>
          )}

          {mode === "create" && !current && (
            <SaleForm
              saleNumber={selected}
              onSubmit={async (input) => {
                const result = await createSale(input);
                if (result.ok) close();
                return result;
              }}
              onCancel={close}
            />
          )}

          {mode === "edit" && current && (
            <SaleForm
              saleNumber={current.number}
              initialName={current.buyerName}
              initialPhone={current.buyerPhone ?? ""}
              onSubmit={async (input) => {
                const result = await updateSale(input);
                if (result.ok) setMode("detail");
                return result;
              }}
              onCancel={() => setMode("detail")}
            />
          )}

          {mode === "detail" && current && (
            <SaleDetail
              sale={current}
              canEdit={seller.isAdmin || current.sellerId === seller.id}
              onEdit={() => setMode("edit")}
              onRelease={release}
              onClose={close}
            />
          )}
        </div>
      )}
    </>
  );
}
```

Crear `app/panel/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PanelSale } from "@/components/sale-detail";
import { PanelBoard } from "./panel-board";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const seller = await getCurrentSeller();
  if (!seller) redirect("/login");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("sales")
    .select("number, buyer_name, buyer_phone, seller_id, sold_at, sellers(display_name)")
    .order("number");

  const sales: PanelSale[] = (data ?? []).map((row) => ({
    number: row.number,
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone,
    sellerId: row.seller_id,
    sellerName:
      (row.sellers as unknown as { display_name: string } | null)?.display_name ?? "Sin dato",
    soldAt: row.sold_at,
  }));

  return (
    <>
      <SiteHeader seller={seller} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 pb-40">
        <h1 className="font-display text-3xl uppercase tracking-wide">Panel</h1>
        {error ? (
          <p role="alert" className="rounded-2xl border border-border bg-card p-4">
            No pudimos cargar las ventas. Actualizá la página antes de vender: sin esta información
            no sabés qué números están tomados.
          </p>
        ) : (
          <PanelBoard sales={sales} seller={seller} />
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 7: Verificar Realtime con dos ventanas**

Abrir `/panel` en dos ventanas del navegador, logueadas. Marcar un número en una.
Expected: la otra lo muestra vendido en menos de dos segundos, sin refrescar.

Probar el aviso de "te lo ganaron": abrir el formulario de un número libre, insertar ese mismo
número desde otra sesión, y confirmar que el formulario se reemplaza por el detalle con el nombre
de quien lo vendió. Después probar el choque al guardar y confirmar que el mensaje nombra a la
vendedora en lugar del texto genérico.

Probar el buscador: escribir `47` y después el nombre de una compradora cargada.
Expected: la grilla se reduce a los números que coinciden; con texto sin coincidencias aparece el mensaje vacío.

Después, probar el conflicto: abrir el mismo número libre en ambas ventanas **antes** de guardar en ninguna, y guardar en las dos.
Expected: la segunda muestra "El N ya está vendido. Actualizá la grilla y elegí otro."

- [ ] **Step 8: Commit**

```bash
git add app/actions/sales.ts app/panel components/sale-form.tsx components/sale-form.test.tsx components/sale-detail.tsx
git commit -m "feat: panel de ventas con realtime"
```

---

### Task 11: Contaduría

**Files:**
- Create: `components/accounting-table.tsx`
- Create: `components/accounting-table.test.tsx`
- Create: `app/contaduria/page.tsx`

**Interfaces:**
- Consumes: `summarize()`, `AccountingSummary` de `lib/accounting.ts`; `getCurrentSeller()`, `createServerSupabase()`, `<SiteHeader />`.
- Produces: `<AccountingTable summary={...} />`.

- [ ] **Step 1: Escribir el test que falla**

Crear `components/accounting-table.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
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

  it("shows a dash for a seller with no sales", () => {
    const summary = summarize(sellers, [{ number: 1, sellerId: "a" }]);
    render(<AccountingTable summary={summary} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- components/accounting-table.test.tsx`
Expected: FAIL — `Failed to resolve import "./accounting-table"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `components/accounting-table.tsx`:

```tsx
import type { AccountingSummary } from "@/lib/accounting";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function AccountingTable({ summary }: { summary: AccountingSummary }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Ventas y montos por vendedora</caption>
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Vendedora</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Vendidos</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Monto</th>
            <th scope="col" className="px-4 py-3 font-semibold">Números</th>
          </tr>
        </thead>
        <tbody>
          {summary.bySeller.map((row) => (
            <tr key={row.sellerId} className="border-b border-border last:border-0">
              <th scope="row" className="px-4 py-3 font-semibold">{row.displayName}</th>
              <td className="px-4 py-3 text-right tabular-nums">{row.count}</td>
              <td className="px-4 py-3 text-right tabular-nums">{money.format(row.amount)}</td>
              <td className="px-4 py-3 text-muted-foreground tabular-nums">
                {row.numbers.length > 0 ? row.numbers.join(", ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- components/accounting-table.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Escribir la página**

Crear `app/contaduria/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AccountingTable } from "@/components/accounting-table";
import { SiteHeader } from "@/components/site-header";
import { summarize } from "@/lib/accounting";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default async function AccountingPage() {
  const seller = await getCurrentSeller();
  if (!seller) redirect("/login");

  const supabase = await createServerSupabase();
  const [{ data: sellerRows }, { data: saleRows }] = await Promise.all([
    supabase.from("sellers").select("id, display_name"),
    supabase.from("sales").select("number, seller_id"),
  ]);

  const summary = summarize(
    (sellerRows ?? []).map((row) => ({ id: row.id, displayName: row.display_name })),
    (saleRows ?? []).map((row) => ({ number: row.number, sellerId: row.seller_id })),
  );

  return (
    <>
      <SiteHeader seller={seller} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
        <h1 className="font-display text-3xl uppercase tracking-wide">Números</h1>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">Recaudado</dt>
            <dd className="font-display text-2xl tabular-nums">{money.format(summary.collected)}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">Falta vender</dt>
            <dd className="font-display text-2xl tabular-nums">{money.format(summary.pending)}</dd>
          </div>
        </dl>

        <AccountingTable summary={summary} />
      </main>
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/accounting-table.tsx components/accounting-table.test.tsx app/contaduria
git commit -m "feat: pantalla de contaduria"
```

---

### Task 12: Gestión de la allowlist

**Files:**
- Create: `app/actions/sellers.ts`
- Create: `components/sellers-table.tsx`
- Create: `components/sellers-table.test.tsx`
- Create: `app/admin/admin-board.tsx`
- Create: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `canRemoveSeller()`, `canRevokeAdmin()`, `SellerRow` de `lib/sellers.ts`; `ActionResult` de `app/actions/sales.ts`; `getCurrentSeller()`, `createServerSupabase()`, `<SiteHeader />`.
- Produces: `addSeller(input: { email: string; displayName: string }): Promise<ActionResult>`, `setAdmin(sellerId: string, isAdmin: boolean): Promise<ActionResult>`, `removeSeller(sellerId: string): Promise<ActionResult>`, `interface AdminSellerRow extends SellerRow { email: string; hasLoggedIn: boolean }`, `<SellersTable rows={...} onToggleAdmin={...} onRemove={...} />`.

- [ ] **Step 1: Escribir las Server Actions**

Crear `app/actions/sellers.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "./sales";

const NOT_ADMIN: ActionResult = {
  ok: false,
  message: "Solo una admin puede gestionar las vendedoras.",
};

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function addSeller(input: {
  email: string;
  displayName: string;
}): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller?.isAdmin) return NOT_ADMIN;

  const email = input.email.trim().toLowerCase();
  if (!looksLikeEmail(email)) return { ok: false, message: "Ese email no parece válido." };
  if (!input.displayName.trim()) return { ok: false, message: "Cargá el nombre." };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("sellers")
    .insert({ email, display_name: input.displayName.trim() });

  if (error?.code === "23505") return { ok: false, message: "Ese email ya está en la lista." };
  if (error) return { ok: false, message: "No se pudo agregar. Probá de nuevo." };

  revalidatePath("/admin");
  return { ok: true };
}

export async function setAdmin(sellerId: string, isAdmin: boolean): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller?.isAdmin) return NOT_ADMIN;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("sellers").update({ is_admin: isAdmin }).eq("id", sellerId);

  if (error) {
    return {
      ok: false,
      message: "No se pudo cambiar. No puede quedar la rifa sin ninguna admin.",
    };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function removeSeller(sellerId: string): Promise<ActionResult> {
  const seller = await getCurrentSeller();
  if (!seller?.isAdmin) return NOT_ADMIN;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("sellers").delete().eq("id", sellerId);

  if (error?.code === "23503") {
    return { ok: false, message: "Tiene ventas cargadas. No se puede borrar." };
  }
  if (error) {
    return { ok: false, message: "No se pudo borrar. No puede quedar la rifa sin ninguna admin." };
  }

  revalidatePath("/admin");
  return { ok: true };
}
```

- [ ] **Step 2: Escribir el test que falla**

Crear `components/sellers-table.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
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
  it("flags who never logged in", () => {
    renderTable([soleAdmin, neverLoggedIn]);
    expect(screen.getByText("Nunca ingresó")).toBeInTheDocument();
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
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -- components/sellers-table.test.tsx`
Expected: FAIL — `Failed to resolve import "./sellers-table"`.

- [ ] **Step 4: Escribir la implementación mínima**

Crear `components/sellers-table.tsx`:

```tsx
"use client";

import { canRemoveSeller, canRevokeAdmin, type SellerRow } from "@/lib/sellers";

export interface AdminSellerRow extends SellerRow {
  email: string;
  hasLoggedIn: boolean;
}

interface SellersTableProps {
  rows: AdminSellerRow[];
  onToggleAdmin: (row: AdminSellerRow) => void;
  onRemove: (row: AdminSellerRow) => void;
}

const ACTION_CLASS =
  "min-h-[44px] touch-manipulation rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SellersTable({ rows, onToggleAdmin, onRemove }: SellersTableProps) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const removal = canRemoveSeller(row, rows);
        const revocation = row.isAdmin ? canRevokeAdmin(row, rows) : { allowed: true as const };
        const blocked = removal.allowed ? null : removal.reason;

        return (
          <li
            key={row.id}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-card-foreground"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-semibold">{row.displayName}</span>
              <span className="text-sm text-muted-foreground">{row.email}</span>
              {row.isAdmin && (
                <span className="rounded-lg bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                  Admin
                </span>
              )}
              {!row.hasLoggedIn && (
                <span className="text-xs text-muted-foreground">Nunca ingresó</span>
              )}
            </div>

            {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!revocation.allowed}
                onClick={() => onToggleAdmin(row)}
                aria-label={`${row.isAdmin ? "Sacar" : "Hacer"} admin a ${row.displayName}`}
                className={ACTION_CLASS}
              >
                {row.isAdmin ? "Sacar admin" : "Hacer admin"}
              </button>
              <button
                type="button"
                disabled={!removal.allowed}
                onClick={() => onRemove(row)}
                aria-label={`Dar de baja a ${row.displayName}`}
                className={ACTION_CLASS}
              >
                Dar de baja
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -- components/sellers-table.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Escribir la pantalla de admin**

Crear `app/admin/admin-board.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SellersTable, type AdminSellerRow } from "@/components/sellers-table";
import { addSeller, removeSeller, setAdmin } from "@/app/actions/sellers";

export function AdminBoard({ rows }: { rows: AdminSellerRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addSeller({ email, displayName });
    setMessage(result.ok ? null : (result.message ?? "No se pudo agregar."));
    if (result.ok) {
      setEmail("");
      setDisplayName("");
      router.refresh();
    }
  }

  async function toggleAdmin(row: AdminSellerRow) {
    const result = await setAdmin(row.id, !row.isAdmin);
    setMessage(result.ok ? null : (result.message ?? null));
    router.refresh();
  }

  async function remove(row: AdminSellerRow) {
    if (!window.confirm(`¿Dar de baja a ${row.displayName}?`)) return;
    const result = await removeSeller(row.id);
    setMessage(result.ok ? null : (result.message ?? null));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <label htmlFor="new-name" className="text-sm font-semibold">Nombre</label>
        <input
          id="new-name"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-background px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label htmlFor="new-email" className="text-sm font-semibold">Email</label>
        <input
          id="new-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-background px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Agregar vendedora
        </button>
      </form>

      {message && (
        <p role="alert" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <SellersTable rows={rows} onToggleAdmin={toggleAdmin} onRemove={remove} />
    </div>
  );
}
```

Crear `app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentSeller } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AdminSellerRow } from "@/components/sellers-table";
import { AdminBoard } from "./admin-board";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const seller = await getCurrentSeller();
  if (!seller) redirect("/login");
  if (!seller.isAdmin) redirect("/panel");

  const supabase = await createServerSupabase();
  const [{ data: sellerRows }, { data: saleRows }] = await Promise.all([
    supabase.from("sellers").select("id, email, display_name, is_admin, user_id").order("display_name"),
    supabase.from("sales").select("seller_id"),
  ]);

  const sellersWithSales = new Set((saleRows ?? []).map((row) => row.seller_id));

  const rows: AdminSellerRow[] = (sellerRows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    hasSales: sellersWithSales.has(row.id),
    hasLoggedIn: row.user_id !== null,
  }));

  return (
    <>
      <SiteHeader seller={seller} />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
        <h1 className="font-display text-3xl uppercase tracking-wide">Vendedoras</h1>
        <AdminBoard rows={rows} />
      </main>
    </>
  );
}
```

- [ ] **Step 7: Verificar la suite completa**

Run: `npm test && npm run typecheck && npm run build`
Expected: todos los tests unitarios pasan, sin errores de tipos, build exitoso.

Run: `supabase db reset && npm run test:rls`
Expected: PASS, 12 tests.

- [ ] **Step 8: Commit**

```bash
git add app/actions/sellers.ts app/admin components/sellers-table.tsx components/sellers-table.test.tsx
git commit -m "feat: gestion de la allowlist de vendedoras"
```

---

### Task 13: Despliegue en Supabase, Vercel y GitHub

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la app publicada.

Vercel Hobby no tiene límite práctico de proyectos: no hay que borrar nada. Supabase free permite 2 proyectos activos por organización, y hoy hay 1 (`bdmaryvfvxemnxzgzlel`, compartido por `torneo-playfutbol` y `mundial-hoy`). Este proyecto ocupa el segundo slot.

- [ ] **Step 1: Crear el proyecto de Supabase y subir el esquema**

Crear el proyecto desde `https://supabase.com/dashboard` con nombre `rifa-pf-femenino`, región `South America (São Paulo)`. Guardar la contraseña de la base.

```bash
supabase link --project-ref <ref-del-proyecto-nuevo>
supabase db push
```

Expected: aplica `0001_init.sql` y `0002_seed_admin.sql`.

- [ ] **Step 2: Configurar Auth**

En el dashboard, `Authentication → URL Configuration`:
- **Site URL**: `https://rifa-pf-femenino.vercel.app`
- **Redirect URLs**: agregar `https://rifa-pf-femenino.vercel.app/auth/callback` y `http://localhost:3000/auth/callback`

En `Authentication → Providers → Email`: dejar habilitado, y **desactivar "Confirm email"** no hace falta porque el magic link ya confirma.

El SMTP por defecto de Supabase tiene un límite bajo de mails por hora. Si el grupo se loguea todo junto el mismo día y algunos no reciben el link, configurar un SMTP propio en `Project Settings → Authentication → SMTP Settings`.

- [ ] **Step 3: Crear el repo remoto y subir**

**Pedirle autorización al usuario antes de este paso.** El push publica el código.

```bash
git remote add origin git@github.com:matiasnsartori/rifa-pf-femenino.git
git push -u origin main
```

Nota: el repo se creó esperando `master`; con `git push -u origin main` la rama pasa a ser `main`. Después, en GitHub, `Settings → Branches → Default branch` y dejar `main`.

- [ ] **Step 4: Crear el proyecto en Vercel y cargar las variables**

```bash
vercel link --yes --project rifa-pf-femenino
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY preview
```

Los valores salen del dashboard de Supabase, `Project Settings → API Keys`: la URL del proyecto y la **publishable key** (NO la `service_role`, que nunca va al cliente).

- [ ] **Step 5: Desplegar y verificar**

```bash
vercel --prod
```

Verificar en el celular:
1. Abrir la URL de producción sin sesión → se ve la grilla, no se ven nombres.
2. Instalar como PWA (Android: banner de instalación; iOS: Compartir → Agregar a inicio).
3. Loguearse con el mail del admin del seed → entra a `/panel`.
4. Cargar una venta desde el celular y ver que aparece en la compu sin refrescar.
5. Ir a `/admin` y agregar una vendedora de prueba.

Confirmar que `anon` no lee `sales` en producción:

```bash
curl -s "https://<ref>.supabase.co/rest/v1/sales?select=buyer_name" -H "apikey: <publishable-key>"
```

Expected: `[]`.

- [ ] **Step 6: Escribir el README**

Reemplazar `README.md`:

```markdown
# Rifa PF Femenino

App para llevar la contaduría de una rifa de 200 números. Muestra en vivo qué números
quedan libres para que dos vendedoras no vendan el mismo.

## Stack

Next 16 (App Router) · React 19 · Tailwind 4 · Supabase (Postgres, Auth, Realtime) · Vercel.

## Desarrollo

```bash
npm install
supabase start
cp .env.example .env.local   # completar con los valores de `supabase status`
npm run dev
```

Los mails de login locales se leen en Inbucket: http://127.0.0.1:54324

## Tests

```bash
npm test          # unitarios y de componentes
npm run test:rls  # policies de RLS, requiere `supabase start`
npm run typecheck
```

## Alta de vendedoras

Se hace desde `/admin`, con cuenta admin. Se carga el email antes de que la persona
se loguee; al primer login la cuenta se ata sola.

El primer admin se define en `supabase/migrations/0002_seed_admin.sql`.

## Documentación

- Diseño: `docs/superpowers/specs/2026-09-19-rifa-pf-femenino-design.md`
- Plan: `docs/superpowers/plans/2026-09-19-rifa-pf-femenino.md`
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: readme del proyecto"
```

---

## Notas de ejecución

- **`npm run build` no se corre salvo que un step lo pida.** Los steps que lo piden son los de verificación de las Tasks 8 y 12.
- **Nunca hacer `git push` sin autorización explícita del usuario.** El único step que empuja es el Step 3 de la Task 13, y pide autorización antes.
- Si un test falla por algo que no está en el plan, no adaptar el test al código: revisar si el plan está mal y decirlo.
