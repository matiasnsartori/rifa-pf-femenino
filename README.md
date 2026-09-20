# Rifa PF Femenino

App para llevar la contaduría de una rifa de 200 números vendida por un grupo de vendedoras
desde sus celulares. Resuelve un solo problema: que dos vendedoras nunca vendan el mismo
número. La grilla se actualiza en vivo en todos los dispositivos, y sobre eso se arma la
contaduría (cuánto se recaudó, cuánto vendió cada una).

## Stack

Next 16.3.5 (App Router) · React 19 · Tailwind 4 · Supabase (Postgres, Auth, Realtime) ·
Vercel.

## Desarrollo local

```bash
npm install
supabase start
cp .env.example .env.local   # completar con los valores de `supabase status`
npm run dev
```

`.env.local` necesita `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
ambos salen de `supabase status` (o de `supabase status -o env`).

Los mails de login (magic link) en desarrollo no se envían a ningún lado real: quedan en
**Mailpit**, en `http://127.0.0.1:54324`.

### Supabase Studio está deshabilitado a propósito

`supabase/config.toml` tiene `[studio] enabled = false`. No es un descuido: en macOS, Docker
Desktop no puede montar rutas debajo de `~/Documents`, y el contenedor de Studio es el único
de la stack que necesita ese tipo de mount. Con Studio habilitado, `supabase start` levanta el
resto de los contenedores y después tira abajo la stack entera al fallar el mount de Studio.

Para inspeccionar la base local, usar `psql` directamente (la connection string la da
`supabase status`) en lugar de Studio. Vale la pena tenerlo presente antes de perder tiempo
buscando por qué `supabase start` no levanta.

## Tests

```bash
npm test          # 56 tests unitarios y de componentes
npm run test:rls  # 14 tests de policies RLS, requieren `supabase start`
npm run typecheck
npm run lint
```

Para `test:rls`, exportar antes las credenciales del stack local:

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
```

Lint y typecheck limpios son parte de terminado en este proyecto, no un paso opcional.

## Alta de vendedoras

Se hace desde `/admin`, con una cuenta admin. El email se autoriza *antes* de que la persona
exista como usuaria: queda en la allowlist de `sellers` y la cuenta se ata sola en su primer
login con magic link. Los admins iniciales están sembrados en
`supabase/migrations/0002_seed_admin.sql`; a partir de ahí, todo el resto de la gestión
(alta, baja, marcar/desmarcar admin) se hace desde `/admin`.

## Cómo funciona

Dos decisiones sostienen toda la app; quien las toque debe entender por qué están así.

**La unicidad del número la garantiza Postgres, no el cliente.** `sales.number` es
`PRIMARY KEY`. El código nunca hace un `select` para chequear si un número está libre antes de
insertar — ese chequeo previo tiene una ventana de carrera entre dos vendedoras y da falsa
seguridad. En cambio, siempre inserta directo y traduce el error `23505` de Postgres
(`unique_violation`) a un mensaje ("el número ya está vendido") en `lib/errors.ts`. Agregar una
verificación previa reintroduciría la carrera que esto evita.

**RLS no confía en el rol `authenticated`.** Cualquiera puede pedir un magic link con su propio
email y quedar autenticado en Supabase Auth; por eso las policies de `sales` y `sellers` no usan
ese rol como sujeto, sino la pertenencia a la allowlist vía `is_seller()` / `is_raffle_admin()`.
La grilla pública (`/`) lee la vista `public_numbers`, que expone solo la columna `number`; esa
vista tiene `revoke`s explícitos sobre `anon`/`authenticated` en la migración, porque Supabase
la crea automáticamente actualizable y sin esos `revoke` cualquier visitante anónimo podría
borrar filas de `sales` a través de ella.

## Documentación

- Diseño: `docs/superpowers/specs/2026-09-19-rifa-pf-femenino-design.md`
- Plan: `docs/superpowers/plans/2026-09-19-rifa-pf-femenino.md`
