# Diseño — `rifa-pf-femenino`

**Fecha:** 2026-09-19
**Estado:** Aprobado (brainstorming) — pendiente de spec review del usuario
**Base:** Codebase nuevo (Next 16.3.5 + React 19 + Tailwind 4), tomando de `torneo-playfutbol`
la arquitectura de tokens de diseño, el patrón PWA y la integración con Supabase.

---

## 1. Resumen

App web para llevar la contaduría de una rifa de **200 números** vendida por **12 personas**.

El problema que resuelve es uno solo y es concreto: hoy no hay forma de saber, en el momento
de vender, si el número que estás por ofrecer ya lo vendió otra. La app es la fuente única de
verdad sobre qué números están tomados, y se actualiza en vivo en todos los dispositivos.

Sobre eso, suma la contaduría: cuánto se recaudó, cuánto vendió cada una y qué números tiene
cada una.

**Reparto de números:** pool común. Nadie tiene un talonario asignado; cualquiera vende
cualquier número libre.

## 2. Decisiones de arquitectura

| Decisión | Elección | Por qué |
|----------|----------|---------|
| Garantía de unicidad | `PRIMARY KEY` sobre `sales.number` | La validación vive en Postgres, no en el cliente. Dos escrituras concurrentes no pueden ganar las dos. |
| Modelo de estados | Solo `libre` / `vendido`, sin tabla de estados | Un número vendido es una fila en `sales`; uno libre es la ausencia de fila. No hay estado que desincronizar. |
| Sincronización | Supabase Realtime (`postgres_changes` sobre `sales`) | Es el requisito central: todas ven el mismo tablero sin refrescar. |
| Identidad | Supabase Auth, magic link por email | Trazabilidad real por venta y RLS que cierra. Sesión persistente: se loguean una vez. |
| Exposición pública | VIEW `public_numbers` con una sola columna | RLS filtra filas, no columnas. Para esconder `buyer_name`/`buyer_phone` de `anon` la herramienta correcta es una vista. |
| Proyecto Supabase | Proyecto **nuevo**, no reusar el de `torneo-playfutbol` | Aísla `auth.users` y las policies. Deja el free tier en 2/2 proyectos activos. |
| Proyecto Vercel | Proyecto nuevo `rifa-pf-femenino` | Hobby no tiene límite práctico de proyectos. No hay que borrar nada. |
| Precio del número | Constante en `lib/raffle.ts` | Se define una vez. Una tabla de configuración para un valor único es ceremonia vacía. |
| i18n | No | App monolingüe en español. |
| Offline | No | Sin service worker. La PWA es instalable, no offline. Ver §9. |

## 3. Modelo de datos

### 3.1 `sellers`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | FK a `auth.users(id)`, `on delete cascade` |
| `display_name` | `text not null` | Nombre que se muestra en la app |
| `is_admin` | `boolean not null default false` | Puede corregir o liberar ventas ajenas |
| `created_at` | `timestamptz not null default now()` | |

Las 12 filas se cargan a mano una única vez, después de que cada una se loguee por primera vez.
No hay pantalla de alta de vendedoras: para 12 personas y un solo evento, construir un ABM es
trabajo que nadie va a usar dos veces.

### 3.2 `sales`

| Columna | Tipo | Notas |
|---------|------|-------|
| `number` | `smallint` PK | `check (number between 1 and 200)` |
| `buyer_name` | `text not null` | `check (length(trim(buyer_name)) > 0)` |
| `buyer_phone` | `text` | Opcional |
| `seller_id` | `uuid not null` | FK a `sellers(id)` |
| `sold_at` | `timestamptz not null default now()` | |

Solo existen filas para los números **vendidos**. Los libres son los que no están en la tabla.

### 3.3 `public_numbers` (VIEW)

```sql
create view public_numbers
with (security_invoker = off)
as select number from sales;
```

`security_invoker = off` es deliberado: la vista corre con los permisos de su dueño y por eso
puede leer `sales` aunque `anon` no tenga acceso a la tabla. Es el único punto del sistema donde
se elude RLS a propósito, y expone exactamente una columna de tipo entero.

### 3.4 RLS

`sales` y `sellers` con RLS habilitado.

Supabase Auth deja que **cualquier email** pida un magic link y quede autenticado. Por eso el
rol `authenticated` **no** es el sujeto de las policies: si lo fuera, un desconocido se loguearía
con su propio mail y leería los datos de todos los compradores.

El sujeto es la pertenencia a `sellers`, expresada con un helper:

```sql
create function is_seller() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sellers where id = auth.uid());
$$;
```

| Rol | `public_numbers` | `sales` | `sellers` |
|-----|------------------|---------|-----------|
| `anon` | `select` | — | — |
| `authenticated` sin fila en `sellers` | `select` | — | — |
| `authenticated` con fila en `sellers` | `select` | `select` todo; `insert` con `seller_id = auth.uid()`; `update`/`delete` solo propias o si `is_admin` | `select` todo |

La policy de `insert` fuerza `seller_id = auth.uid()`: nadie puede registrar una venta a nombre
de otra.

El mensaje "tu cuenta no está habilitada" de §5.2 es cortesía de UI, no seguridad. La barrera
real es `is_seller()`.

## 4. Manejo del conflicto de concurrencia

Es el escenario central de la app y se diseña explícitamente.

1. Dos vendedoras ven el número 47 libre.
2. Ambas envían el formulario.
3. La primera inserta. La segunda recibe de Postgres el error **23505** (`unique_violation`).
4. La app traduce ese código a un mensaje concreto: *"El 47 lo acaba de vender Ana. Elegí otro."*
5. La grilla de la segunda ya se actualizó sola por Realtime.

El error 23505 no es una falla: es la base cumpliendo su función. El código nunca hace un
`select` previo para "chequear si está libre" — ese chequeo tiene una ventana de carrera y da
falsa seguridad.

## 5. Pantallas

### 5.1 `/` — grilla pública

Grilla de 200 celdas. Libre y vendido se distinguen por **color + forma + texto**, nunca solo
por color. Contador arriba: `137 libres · 63 vendidos`. Sin nombres ni teléfonos.
Server Component con `revalidate` corto; sin Realtime (no hace falta para difusión).

### 5.2 `/login` — magic link

Input de email, envía el link, pantalla de "revisá tu correo". Si el email no está en `sellers`,
el login funciona pero la app muestra "Tu cuenta no está habilitada".

### 5.3 `/panel` — operación (requiere sesión)

La misma grilla, interactiva y con Realtime.
- Tocar un número **libre** → formulario: nombre del comprador (requerido) y teléfono (opcional).
- Tocar un número **vendido** → detalle: comprador, teléfono, quién lo vendió y cuándo.
  Editar o liberar solo si es propia o si sos admin.
- Buscador por número y por nombre de comprador.

### 5.4 `/contaduria` — números (requiere sesión)

- Total recaudado y total pendiente (números libres × precio).
- Tabla por vendedora: cantidad vendida, monto y sus números.
- Orden por monto descendente.

## 6. Estructura de archivos

```
app/
  layout.tsx            Fuentes, ThemeProvider, metadata
  manifest.ts           Web App Manifest (PWA)
  page.tsx              Grilla pública
  login/page.tsx
  auth/callback/route.ts
  panel/page.tsx
  contaduria/page.tsx
  actions/sales.ts      Server Actions: createSale, updateSale, releaseSale
components/
  number-grid.tsx       Presentacional, sin fetch
  number-cell.tsx
  sale-form.tsx
  sale-detail.tsx
  accounting-table.tsx
  theme-toggle.tsx
  install-app.tsx
lib/
  raffle.ts             TOTAL_NUMBERS, PRICE_PER_NUMBER, helpers
  errors.ts             Traducción de códigos Postgres a mensajes
  accounting.ts         Cálculo de totales por vendedora (función pura)
  supabase/{client,server,middleware}.ts
supabase/migrations/
  0001_init.sql         Tablas, vista, RLS, Realtime
```

Separación contenedor/presentacional: los componentes de `components/` reciben datos por props y
no hablan con Supabase. Eso los hace testeables sin base.

## 7. Estética

Se replica la **arquitectura** de `torneo-playfutbol`, no su paleta:

- Tokens semánticos en CSS vars sobre `:root` y `.dark`, proyectados con `@theme inline`.
- Light/dark con `next-themes`, variante `@custom-variant dark`.
- Tailwind 4 sin archivo de config.
- Tipografías: Anton (display) + Archivo (body), vía `next/font`.
- Fondo con gradientes CSS, sin imágenes.
- `@media (prefers-reduced-motion: reduce)` respetado.

Paleta propia, distinta del verde cancha. Se define en implementación con contraste WCAG AA
verificado (4.5:1 en texto, 3:1 en texto grande y en los bordes de las celdas de la grilla).

## 8. Testing

Vitest. TDD: el test se escribe antes que la implementación.

| Qué | Por qué importa |
|-----|-----------------|
| `lib/errors.ts` — 23505 → mensaje de número tomado | Es el camino de error central de la app |
| `lib/accounting.ts` — totales, vendedora sin ventas, redondeo | Es plata; un error acá se discute entre personas |
| `lib/raffle.ts` — rango 1..200, cálculo de libres | Invariante del dominio |
| RLS — un usuario no puede insertar con `seller_id` ajeno | La policy es seguridad, no una convención |
| RLS — `anon` no lee `sales`, sí `public_numbers` | Protege dato personal de terceros |
| RLS — un `authenticated` sin fila en `sellers` no lee `sales` | Cualquiera puede autenticarse con su propio mail; es el vector más probable |

Los tests de RLS corren contra una Supabase local (`supabase start`) en `supabase/tests/`.

## 9. Riesgos y límites asumidos

| Riesgo | Mitigación / decisión |
|--------|----------------------|
| Sin offline: si no hay señal, no se puede marcar | Asumido. Si aparece el caso real, se evalúa un service worker con cola de escritura. No se construye antes. |
| El proyecto Supabase free se pausa a los 7 días sin actividad | Durante la rifa hay uso diario. Al terminar, exportar los datos antes de que se duerma. |
| Dato personal de compradores (nombre y teléfono) | Nunca sale del lado autenticado. La vista pública expone solo el entero. |
| Borrar una venta por error | `releaseSale` pide confirmación; solo la dueña o un admin. Sin papelera: para 200 números, recargar el dato es más barato que mantener soft-delete. |
| Free tier de Supabase queda en 2/2 proyectos | Un proyecto más requiere pausar o borrar otro, o pasar a Pro. |

## 10. Fuera de alcance

- Múltiples rifas o ediciones.
- Estados `reservado` y `rendido`.
- Talonarios o rangos por vendedora.
- Sorteo del ganador dentro de la app.
- Notificaciones push.
- ABM de vendedoras por UI.
- Exportar a Excel/PDF.
