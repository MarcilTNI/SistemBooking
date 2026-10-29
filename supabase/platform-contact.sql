-- Run this migration to let platform administrators manage a private
-- WhatsApp contact number for authenticated merchant owners.

begin;

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  admin_whatsapp text check (admin_whatsapp is null or admin_whatsapp ~ '^[0-9]{10,15}$'),
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
revoke all privileges on table public.platform_settings from public, anon, authenticated;

insert into public.platform_settings (id, admin_whatsapp)
values (true, null)
on conflict (id) do nothing;

drop function if exists public.admin_list_mitra();
create function public.admin_list_mitra()
returns table (
  id uuid,
  slug text,
  nama text,
  kategori text,
  alamat text,
  email text,
  telepon text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Akses khusus pengelola platform.';
  end if;
  return query
  select m.id, m.slug, m.nama, m.kategori, m.alamat, m.email, m.telepon, m.is_active
  from public.mitra m
  order by m.nama;
end;
$function$;

create or replace function public.admin_update_mitra_whatsapp(p_mitra_id uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Hanya pengelola platform yang dapat mengubah nomor usaha.';
  end if;
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' then
    raise exception 'Nomor WhatsApp usaha harus berisi 10 sampai 15 digit.';
  end if;

  update public.mitra
  set telepon = p_phone
  where id = p_mitra_id;

  if not found then
    raise exception 'Usaha tidak ditemukan.';
  end if;
end;
$function$;

create or replace function public.get_platform_contact_whatsapp()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_phone text;
begin
  if v_user_id is null or not (
    public.is_platform_admin()
    or exists (
      select 1 from public.mitra m where m.auth_user_id = v_user_id
    )
  ) then
    raise exception 'Kontak ini hanya tersedia untuk pengelola dan pemilik mitra yang masuk.';
  end if;

  select s.admin_whatsapp into v_phone
  from public.platform_settings s
  where s.id = true;

  return v_phone;
end;
$function$;

create or replace function public.set_platform_contact_whatsapp(p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Hanya pengelola platform yang dapat mengubah kontak ini.';
  end if;
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' then
    raise exception 'Nomor WhatsApp admin harus berisi 10 sampai 15 digit.';
  end if;

  insert into public.platform_settings (id, admin_whatsapp, updated_at)
  values (true, p_phone, now())
  on conflict (id) do update
  set admin_whatsapp = excluded.admin_whatsapp,
      updated_at = excluded.updated_at;
end;
$function$;

revoke all on function public.get_platform_contact_whatsapp() from public, anon, authenticated;
revoke all on function public.set_platform_contact_whatsapp(text) from public, anon, authenticated;
revoke all on function public.admin_list_mitra() from public, anon, authenticated;
revoke all on function public.admin_update_mitra_whatsapp(uuid, text) from public, anon, authenticated;
grant execute on function public.get_platform_contact_whatsapp() to authenticated;
grant execute on function public.set_platform_contact_whatsapp(text) to authenticated;
grant execute on function public.admin_list_mitra() to authenticated;
grant execute on function public.admin_update_mitra_whatsapp(uuid, text) to authenticated;

commit;
