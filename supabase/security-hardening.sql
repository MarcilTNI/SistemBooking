-- Run after booking-access.sql, tenant-scheduling.sql, and platform-contact.sql.
-- Public shop contact is returned only through a dedicated, read-only RPC.

begin;

revoke select on table public.mitra from public, anon;
revoke select (
  id,
  slug,
  nama,
  kategori,
  alamat,
  telepon,
  jam_mulai,
  jam_selesai,
  is_active
) on table public.mitra from public, anon;

grant select (
  id,
  slug,
  nama,
  kategori,
  alamat,
  jam_mulai,
  jam_selesai,
  is_active
) on table public.mitra to anon;

create or replace function public.get_mitra_public_contact(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select m.telepon
  from public.mitra m
  where m.slug = p_slug
    and m.is_active
  limit 1;
$function$;

revoke all on function public.get_mitra_public_contact(text)
from public, anon, authenticated;
grant execute on function public.get_mitra_public_contact(text)
to anon, authenticated;

commit;
