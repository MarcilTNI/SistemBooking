-- Create the admin account first under Authentication > Users.
-- Replace the email below, then run this query in the Supabase SQL Editor.
do $block$
declare
  v_user_id uuid;
begin
  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower('marcel29051998@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'Akun admin belum ditemukan. Buat user Auth dan ganti ADMIN_EMAIL_HERE terlebih dahulu.';
  end if;

  insert into public.platform_admins (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
end;
$block$;

-- Verify that exactly one admin record is present for this account.
select u.email, a.user_id
from public.platform_admins a
join auth.users u on u.id = a.user_id
where lower(u.email) = lower('marcel29051998@gmail.com');
