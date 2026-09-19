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
