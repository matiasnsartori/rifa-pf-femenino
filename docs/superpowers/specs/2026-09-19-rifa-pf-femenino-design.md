# Diseño — `rifa-pf-femenino`

**Fecha:** 2026-09-19
**Estado:** Aprobado (brainstorming) — pendiente de spec review del usuario
**Base:** Codebase nuevo (Next 16.3.5 + React 19 + Tailwind 4), tomando de `torneo-playfutbol`
la arquitectura de tokens de diseño, el patrón PWA y la integración con Supabase.

---

## 1. Resumen

App web para llevar la contaduría de una rifa de **200 números** vendida por un grupo de
vendedoras. La cantidad de vendedoras es **variable**: se dan de alta y de baja durante la
rifa y no hay ningún número fijo cableado en el diseño.

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
| Habilitación | Allowlist por email en `sellers`, `user_id` se ata al primer login | Permite pre-autorizar antes de que la persona exista en `auth.users`. Sin esto, el alta depende de que se loguee primero. |
| Alta/baja de vendedoras | Pantalla `/admin` dentro de la app | El conjunto es variable; depender del dashboard de Supabase bloquea el alta cuando el admin no está en la compu. |
| Exposición pública | VIEW `public_numbers` con una sola columna | RLS filtra filas, no columnas. Para esconder `buyer_name`/`buyer_phone` de `anon` la herramienta correcta es una vista. |
| Proyecto Supabase | Proyecto **nuevo**, no reusar el de `torneo-playfutbol` | Aísla `auth.users` y las policies. Deja el free tier en 2/2 proyectos activos. |
| Proyecto Vercel | Proyecto nuevo `rifa-pf-femenino` | Hobby no tiene límite práctico de proyectos. No hay que borrar nada. |
| Precio del número | Constante en `lib/raffle.ts` | Se define una vez. Una tabla de configuración para un valor único es ceremonia vacía. |
| i18n | No | App monolingüe en español. |
| Offline | No | Sin service worker. La PWA es instalable, no offline. Ver §9. |

## 3. Modelo de datos

### 3.1 `sellers`

Es la **allowlist**: una fila existe desde que el admin autoriza el email, mucho antes de que
esa persona se loguee por primera vez.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK `default gen_random_uuid()` | Identidad propia, independiente de `auth.users` |
| `email` | `text not null unique` | Clave de la allowlist. Se normaliza a minúsculas y sin espacios con un trigger, en vez de depender de la extensión `citext` |
| `display_name` | `text not null` | Nombre que se muestra en la app |
| `is_admin` | `boolean not null default false` | Puede corregir ventas ajenas y gestionar la allowlist |
| `user_id` | `uuid unique references auth.users(id) on delete set null` | Nullable. Se completa solo, al primer login |
| `created_at` | `timestamptz not null default now()` | |

`user_id` es nullable **a propósito**: separa "está autorizada" de "ya entró alguna vez". Un
trigger `after insert on auth.users` hace el enlace:

```sql
create function link_seller_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update sellers set user_id = new.id where email = new.email and user_id is null;
  return new;
end;
$$;
```

Si el email no está en la allowlist el trigger no hace nada: la persona queda autenticada pero
sin permisos, que es exactamente lo que corresponde.

**El número de vendedoras no aparece en ningún lado del sistema.** Pueden ser 8, 12 o 20, y
puede cambiar en medio de la rifa.

### 3.2 `sales`

| Columna | Tipo | Notas |
|---------|------|-------|
| `number` | `smallint` PK | `check (number between 1 and 200)` |
| `buyer_name` | `text not null` | `check (length(trim(buyer_name)) > 0)` |
| `buyer_phone` | `text` | Opcional |
| `seller_id` | `uuid not null` | FK a `sellers(id)`. Apunta a `sellers`, no a `auth.users` |
| `sold_at` | `timestamptz not null default now()` | |

Solo existen filas para los números **vendidos**. Los libres son los que no están en la tabla.

### 3.3 `public_numbers` (VIEW)

```sql
create view public_numbers
with (security_invoker = off)
as select number from sales;

revoke all on public_numbers from anon, authenticated;
grant select on public_numbers to anon, authenticated;
```

El `revoke` es obligatorio, no cosmético. Supabase concede CRUD completo a `anon` sobre cada relación nueva de `public`; la vista es automáticamente actualizable por ser de una sola tabla; y `security_invoker = off` hace que ese DML corra como el dueño, que saltea RLS. Sin el `revoke`, cualquiera con la anon key borra ventas.

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
create function current_seller_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from sellers where user_id = auth.uid();
$$;

create function is_seller() returns boolean
language sql stable security definer set search_path = public as $$
  select current_seller_id() is not null;
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sellers where user_id = auth.uid() and is_admin);
$$;
```

Las tres son `security definer` porque tienen que leer `sellers` sin quedar atrapadas en la
propia policy que están evaluando. `search_path` fijo evita el vector clásico de secuestro de
esquema en funciones `security definer`.

| Rol | `public_numbers` | `sales` | `sellers` |
|-----|------------------|---------|-----------|
| `anon` | `select` | — | — |
| `authenticated` fuera de la allowlist | `select` | — | — |
| Vendedora (`is_seller()`) | `select` | `select` todo; `insert` con `seller_id = current_seller_id()`; `update`/`delete` solo propias | `select` todo |
| Admin (`is_admin()`) | `select` | todo, incluidas ventas ajenas | `select`, `insert`, `update`, `delete` |

La policy de `insert` sobre `sales` fuerza `seller_id = current_seller_id()`: nadie puede
registrar una venta a nombre de otra.

Dos reglas extra sobre `sellers`, necesarias porque ahí se decide quién entra:

- **Nadie se auto-promueve.** Cambiar `is_admin` requiere `is_admin()`; una vendedora común no
  puede tocar esa columna ni en su propia fila.
- **No se puede quedar sin admins.** Un trigger `before update or delete on sellers` aborta la
  operación si dejaría la tabla con cero admins. Sin esto, un admin se saca el flag por error y
  la allowlist queda congelada para siempre, sin forma de arreglarla desde la app.

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

Grilla de 200 celdas. Libre y vendido se distinguen por **color + tachado + texto accesible**,
nunca solo por color: el tachado es la señal de forma y el `aria-label` dice la palabra "libre" o
"vendido". El grosor del borde es el mismo en los dos estados —solo cambia su color—, así que el
borde no cuenta como señal no cromática. Contador arriba: `137 libres · 63 vendidos`. Sin nombres ni teléfonos.
Server Component con `revalidate` corto; sin Realtime (no hace falta para difusión).

### 5.2 `/login` — magic link

Input de email, envía el link, pantalla de "revisá tu correo". Si el email no está en la
allowlist el login funciona igual, pero la app muestra "Tu cuenta no está habilitada" y no
expone ningún dato. La barrera real es RLS, no esta pantalla.

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

### 5.5 `/admin` — vendedoras (requiere `is_admin()`)

- Lista de la allowlist: nombre, email, si ya entró alguna vez, si es admin, cuánto vendió.
- Agregar: email + nombre. Queda habilitada al instante; entra cuando quiera.
- Marcar o desmarcar admin. El botón se deshabilita si sos el último admin.
- Dar de baja: solo si no tiene ventas cargadas. Si tiene, se bloquea con el motivo a la vista —
  borrarla dejaría ventas huérfanas y la contaduría sin dueño.

Las mismas reglas están en RLS y en triggers. La UI solo las anticipa para dar un mensaje claro.

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
  admin/page.tsx        Gestión de la allowlist
  actions/sales.ts      Server Actions: createSale, updateSale, releaseSale
  actions/sellers.ts    Server Actions: addSeller, setAdmin, removeSeller
components/
  number-grid.tsx       Presentacional, sin fetch
  number-cell.tsx
  sale-form.tsx
  sale-detail.tsx
  accounting-table.tsx
  sellers-table.tsx
  theme-toggle.tsx
  install-app.tsx
lib/
  raffle.ts             TOTAL_NUMBERS, PRICE_PER_NUMBER, helpers
  errors.ts             Traducción de códigos Postgres a mensajes
  accounting.ts         Cálculo de totales por vendedora (función pura)
  sellers.ts            Reglas de baja y de último admin (funciones puras)
  session.ts            getCurrentSeller() para Server Components
  supabase/{client,server,proxy}.ts
proxy.ts                En Next 16 el archivo es `proxy.ts`, no `middleware.ts`
supabase/migrations/
  0001_init.sql         Tablas, vista, funciones, triggers, RLS, Realtime
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
| RLS — un `authenticated` fuera de la allowlist no lee `sales` | Cualquiera puede autenticarse con su propio mail; es el vector más probable |
| Trigger — el primer login ata `user_id` al email pre-autorizado | Es el mecanismo que hace posible el alta previa |
| RLS — una vendedora común no puede setearse `is_admin` | Escalación de privilegios directa |
| Trigger — no se puede borrar ni degradar al último admin | Deja la allowlist sin forma de gestionarse |
| `lib/sellers.ts` — baja bloqueada si tiene ventas | Evita ventas huérfanas en la contaduría |

Los tests de RLS corren contra una Supabase local (`supabase start`) en `supabase/tests/`.

## 9. Riesgos y límites asumidos

| Riesgo | Mitigación / decisión |
|--------|----------------------|
| Sin offline: si no hay señal, no se puede marcar | Asumido. Si aparece el caso real, se evalúa un service worker con cola de escritura. No se construye antes. |
| El proyecto Supabase free se pausa a los 7 días sin actividad | Durante la rifa hay uso diario. Al terminar, exportar los datos antes de que se duerma. |
| Dato personal de compradores (nombre y teléfono) | Nunca sale del lado autenticado. La vista pública expone solo el entero. |
| Borrar una venta por error | `releaseSale` pide confirmación; solo la dueña o un admin. Sin papelera: para 200 números, recargar el dato es más barato que mantener soft-delete. |
| Free tier de Supabase queda en 2/2 proyectos | Un proyecto más requiere pausar o borrar otro, o pasar a Pro. |
| Alta de una vendedora con el email mal escrito | Queda una fila sin `user_id` y la persona no entra. El admin ve "nunca ingresó" en `/admin`, corrige el email y el trigger ata la cuenta en el siguiente login. |
| Los admins iniciales | No pueden crearse desde la app: se insertan una vez en la migración de seed (tres mails). A partir de ahí todo se gestiona desde `/admin`. |

## 10. Fuera de alcance

- Múltiples rifas o ediciones.
- Estados `reservado` y `rendido`.
- Talonarios o rangos por vendedora.
- Sorteo del ganador dentro de la app.
- Notificaciones push.
- Exportar a Excel/PDF.
