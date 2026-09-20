create function public.link_existing_account() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    select id into new.user_id
      from auth.users
     where lower(trim(email)) = lower(trim(new.email))
     limit 1;
  end if;
  return new;
end;
$$;

create trigger sellers_link_existing_account
  before insert or update of email on public.sellers
  for each row execute function public.link_existing_account();
