insert into public.sellers (email, display_name, is_admin)
values
  ('sartorinmatias@gmail.com', 'Matías', true),
  ('sartori828@hotmail.com', 'Sartori', true),
  ('sartoridbz@gmail.com', 'Sartori DBZ', true)
on conflict (email) do update set is_admin = true;
