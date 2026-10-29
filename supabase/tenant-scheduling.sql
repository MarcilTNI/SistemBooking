-- Run after booking-access.sql. This migration enables platform onboarding,
-- per-weekday hours, and consecutive group reservations (one service per group).

begin;

alter table public.mitra
  add column if not exists is_active boolean not null default true;
alter table public.mitra alter column email drop not null;
alter table public.booking
  add column if not exists jumlah_orang integer not null default 1
    check (jumlah_orang between 1 and 12),
  add column if not exists durasi_menit integer;

update public.booking b
set durasi_menit = l.durasi
from public.layanan l
where l.id = b.layanan_id and b.durasi_menit is null;

alter table public.booking
  alter column durasi_menit set not null;

create table if not exists public.jadwal_mingguan (
  mitra_id uuid not null references public.mitra(id) on delete cascade,
  hari smallint not null check (hari between 0 and 6),
  buka boolean not null default true,
  jam_mulai time,
  jam_selesai time,
  istirahat_mulai time,
  istirahat_selesai time,
  primary key (mitra_id, hari),
  check (
    (buka and jam_mulai is not null and jam_selesai is not null and jam_mulai < jam_selesai)
    or (not buka and jam_mulai is null and jam_selesai is null)
  ),
  check (
    (istirahat_mulai is null and istirahat_selesai is null)
    or (
      buka and istirahat_mulai is not null and istirahat_selesai is not null
      and jam_mulai <= istirahat_mulai and istirahat_mulai < istirahat_selesai
      and istirahat_selesai <= jam_selesai
    )
  )
);

insert into public.jadwal_mingguan (
  mitra_id, hari, buka, jam_mulai, jam_selesai, istirahat_mulai, istirahat_selesai
)
select m.id, hari.day_number, true, m.jam_mulai, m.jam_selesai, null, null
from public.mitra m
cross join generate_series(0, 6) as hari(day_number)
on conflict (mitra_id, hari) do nothing;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dibuat_pada timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
alter table public.jadwal_mingguan enable row level security;
revoke all privileges on table public.platform_admins, public.jadwal_mingguan
from anon, authenticated, public;

drop policy if exists "admin can read own platform role" on public.platform_admins;
create policy "admin can read own platform role"
on public.platform_admins for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "public can read active weekly hours" on public.jadwal_mingguan;
drop policy if exists "mitra can read own weekly hours" on public.jadwal_mingguan;
drop policy if exists "mitra can add own weekly hours" on public.jadwal_mingguan;
drop policy if exists "mitra can edit own weekly hours" on public.jadwal_mingguan;
create policy "public can read active weekly hours"
on public.jadwal_mingguan for select to anon
using (exists (
  select 1 from public.mitra m where m.id = mitra_id and m.is_active
));
create policy "mitra can read own weekly hours"
on public.jadwal_mingguan for select to authenticated
using (exists (
  select 1 from public.mitra m
  where m.id = mitra_id
    and (m.auth_user_id = (select auth.uid()) or exists (
      select 1 from public.platform_admins a where a.user_id = (select auth.uid())
    ))
));
create policy "mitra can add own weekly hours"
on public.jadwal_mingguan for insert to authenticated
with check (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
));
create policy "mitra can edit own weekly hours"
on public.jadwal_mingguan for update to authenticated
using (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
));

grant select on public.platform_admins to authenticated;
grant select on public.jadwal_mingguan to anon, authenticated;
grant insert, update on public.jadwal_mingguan to authenticated;
grant select (is_active) on public.mitra to anon;
grant select (id, slug, nama, kategori, alamat, telepon, jam_mulai, jam_selesai, auth_user_id, is_active)
on public.mitra to authenticated;

drop policy if exists "public can read mitra booking profile" on public.mitra;
drop policy if exists "public can read services" on public.layanan;
drop policy if exists "mitra can read own profile" on public.mitra;
drop policy if exists "platform admin can read all shops" on public.mitra;
drop policy if exists "mitra can read own services" on public.layanan;
drop policy if exists "mitra can add own services" on public.layanan;
drop policy if exists "mitra can edit own services" on public.layanan;
drop policy if exists "mitra can remove own services" on public.layanan;
drop policy if exists "mitra can read own bookings" on public.booking;
drop policy if exists "mitra can update own booking status" on public.booking;
drop policy if exists "mitra can read own closures" on public.penutupan_jadwal;

create policy "public can read mitra booking profile"
on public.mitra for select to anon using (is_active);
create policy "platform admin can read all shops"
on public.mitra for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);
create policy "public can read services"
on public.layanan for select to anon
using (exists (
  select 1 from public.mitra m where m.id = mitra_id and m.is_active
));
create policy "mitra can read own services"
on public.layanan for select to authenticated
using (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
));
create policy "mitra can add own services"
on public.layanan for insert to authenticated
with check (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
));
create policy "mitra can edit own services"
on public.layanan for update to authenticated
using (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
));
create policy "mitra can remove own services"
on public.layanan for delete to authenticated
using (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
));
create policy "mitra can read own bookings"
on public.booking for select to authenticated
using (exists (
  select 1 from public.mitra m
  where m.id = mitra_id
    and (m.auth_user_id = (select auth.uid()) or exists (
      select 1 from public.platform_admins a where a.user_id = (select auth.uid())
    ))
));
create policy "mitra can update own booking status"
on public.booking for update to authenticated
using (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
))
with check (
  status in ('menunggu', 'diterima', 'dibatalkan')
  and exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
);
create policy "mitra can read own closures"
on public.penutupan_jadwal for select to authenticated
using (exists (
  select 1 from public.mitra m
  where m.id = mitra_id and m.auth_user_id = (select auth.uid())
));

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  );
$function$;

create or replace function public.get_jadwal_operasional(p_mitra_id uuid)
returns table (
  hari smallint,
  buka boolean,
  jam_mulai time,
  jam_selesai time,
  istirahat_mulai time,
  istirahat_selesai time
)
language sql
stable
security definer
set search_path = ''
as $function$
  select j.hari, j.buka, j.jam_mulai, j.jam_selesai, j.istirahat_mulai, j.istirahat_selesai
  from public.jadwal_mingguan j
  join public.mitra m on m.id = j.mitra_id
  where j.mitra_id = p_mitra_id and m.is_active
  order by j.hari;
$function$;

create or replace function public.admin_create_mitra(
  p_slug text,
  p_nama text,
  p_kategori text,
  p_alamat text,
  p_telepon text,
  p_email_pemilik text,
  p_jadwal jsonb,
  p_layanan jsonb
)
returns table (id uuid, slug text, nama text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid;
  v_mitra_id uuid := gen_random_uuid();
  v_open time;
  v_close time;
  v_item jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Akses khusus pengelola platform.';
  end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) > 60 then
    raise exception 'Slug harus berupa huruf kecil, angka, dan tanda hubung.';
  end if;
  if length(trim(p_nama)) < 2 or length(trim(p_nama)) > 100 then
    raise exception 'Nama usaha harus 2 sampai 100 karakter.';
  end if;
  if jsonb_typeof(p_jadwal) <> 'array' or jsonb_array_length(p_jadwal) <> 7 then
    raise exception 'Jadwal harus berisi tepat tujuh hari.';
  end if;
  if jsonb_typeof(p_layanan) <> 'array' or jsonb_array_length(p_layanan) < 1 then
    raise exception 'Tambahkan minimal satu layanan.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_layanan) as s(nama text, durasi integer, harga integer)
    where s.nama is null or length(trim(s.nama)) not between 2 and 80
      or s.durasi is null or s.durasi not between 30 and 480 or mod(s.durasi, 30) <> 0
      or s.harga is null or s.harga < 0
  ) then
    raise exception 'Salah satu data layanan tidak valid.';
  end if;

  select u.id into v_owner_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email_pemilik))
  limit 1;
  if v_owner_id is null then
    raise exception 'Buat akun pemilik di Supabase Auth terlebih dahulu.';
  end if;

  select min((j->>'jam_mulai')::time), max((j->>'jam_selesai')::time)
  into v_open, v_close
  from jsonb_array_elements(p_jadwal) j
  where (j->>'buka')::boolean;
  if v_open is null or v_close is null then
    raise exception 'Usaha harus buka minimal satu hari.';
  end if;

  insert into public.mitra (
    id, slug, nama, kategori, alamat, telepon, jam_mulai, jam_selesai,
    email, auth_user_id, is_active
  )
  values (
    v_mitra_id, lower(trim(p_slug)), trim(p_nama), trim(p_kategori), trim(p_alamat),
    trim(p_telepon), v_open, v_close, lower(trim(p_email_pemilik)), v_owner_id, true
  );

  insert into public.jadwal_mingguan (
    mitra_id, hari, buka, jam_mulai, jam_selesai, istirahat_mulai, istirahat_selesai
  )
  select
    v_mitra_id, (j->>'hari')::smallint, (j->>'buka')::boolean,
    case when (j->>'buka')::boolean then (j->>'jam_mulai')::time else null end,
    case when (j->>'buka')::boolean then (j->>'jam_selesai')::time else null end,
    nullif(j->>'istirahat_mulai', '')::time,
    nullif(j->>'istirahat_selesai', '')::time
  from jsonb_array_elements(p_jadwal) j;

  insert into public.layanan (mitra_id, nama, durasi, harga)
  select v_mitra_id, trim(s.nama), s.durasi, s.harga
  from jsonb_to_recordset(p_layanan) as s(nama text, durasi integer, harga integer)
  where length(trim(s.nama)) between 2 and 80
    and s.durasi between 30 and 480 and mod(s.durasi, 30) = 0
    and s.harga >= 0;

  if not found then
    raise exception 'Data layanan tidak valid.';
  end if;

  return query select v_mitra_id, lower(trim(p_slug)), trim(p_nama);
end;
$function$;

create or replace function public.admin_list_mitra()
returns table (id uuid, slug text, nama text, kategori text, alamat text, email text, is_active boolean)
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
  select m.id, m.slug, m.nama, m.kategori, m.alamat, m.email, m.is_active
  from public.mitra m
  order by m.nama;
end;
$function$;

create or replace function public.save_jadwal_mingguan(p_mitra_id uuid, p_jadwal jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform 1
  from public.mitra m
  where m.id = p_mitra_id and m.auth_user_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Mitra tidak ditemukan atau akses ditolak.';
  end if;
  if jsonb_typeof(p_jadwal) <> 'array' or jsonb_array_length(p_jadwal) <> 7 then
    raise exception 'Jadwal harus berisi tepat tujuh hari.';
  end if;
  if (select count(distinct (j->>'hari')::smallint) from jsonb_array_elements(p_jadwal) j) <> 7 then
    raise exception 'Setiap hari dalam seminggu harus dicantumkan tepat satu kali.';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_jadwal) j
    where (j->>'buka')::boolean
  ) then
    raise exception 'Usaha harus buka minimal satu hari.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_jadwal) j
    left join public.booking b
      on b.mitra_id = p_mitra_id
      and b.status <> 'dibatalkan'
      and extract(dow from b.tanggal)::smallint = (j->>'hari')::smallint
      and (
        not (j->>'buka')::boolean
        or b.jam_mulai < (j->>'jam_mulai')::time
        or b.jam_selesai > (j->>'jam_selesai')::time
        or (
          nullif(j->>'istirahat_mulai', '') is not null
          and b.jam_mulai < (j->>'istirahat_selesai')::time
          and b.jam_selesai > (j->>'istirahat_mulai')::time
        )
      )
    where b.id is not null and b.tanggal >= (now() at time zone 'Asia/Jakarta')::date
  ) then
    raise exception 'Perubahan jadwal bertabrakan dengan booking mendatang. Pindahkan atau batalkan booking terlebih dahulu.';
  end if;

  insert into public.jadwal_mingguan (
    mitra_id, hari, buka, jam_mulai, jam_selesai, istirahat_mulai, istirahat_selesai
  )
  select
    p_mitra_id, (j->>'hari')::smallint, (j->>'buka')::boolean,
    case when (j->>'buka')::boolean then (j->>'jam_mulai')::time else null end,
    case when (j->>'buka')::boolean then (j->>'jam_selesai')::time else null end,
    nullif(j->>'istirahat_mulai', '')::time,
    nullif(j->>'istirahat_selesai', '')::time
  from jsonb_array_elements(p_jadwal) j
  on conflict (mitra_id, hari) do update set
    buka = excluded.buka,
    jam_mulai = excluded.jam_mulai,
    jam_selesai = excluded.jam_selesai,
    istirahat_mulai = excluded.istirahat_mulai,
    istirahat_selesai = excluded.istirahat_selesai;
end;
$function$;

drop function if exists public.get_slot_tersedia(uuid, uuid, date);
drop function if exists public.get_slot_tersedia(uuid, uuid, date, integer);
create function public.get_slot_tersedia(
  p_mitra_id uuid,
  p_layanan_id uuid,
  p_tanggal date,
  p_jumlah_orang integer default 1
)
returns table (jam_mulai time, jam_selesai time, status text, tersedia boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_jadwal public.jadwal_mingguan%rowtype;
  v_durasi integer;
  v_mulai time;
  v_selesai time;
  v_status text;
  v_now timestamp;
begin
  if p_jumlah_orang not between 1 and 12 then
    raise exception 'Jumlah orang harus antara 1 sampai 12.';
  end if;
  select j.* into v_jadwal from public.jadwal_mingguan j
  join public.mitra m on m.id = j.mitra_id
  where j.mitra_id = p_mitra_id and j.hari = extract(dow from p_tanggal)::smallint
    and j.buka and m.is_active;
  if not found then return; end if;

  select l.durasi * p_jumlah_orang into v_durasi
  from public.layanan l
  where l.id = p_layanan_id and l.mitra_id = p_mitra_id;
  if not found then raise exception 'Layanan tidak ditemukan.'; end if;

  v_now := now() at time zone 'Asia/Jakarta';
  v_mulai := v_jadwal.jam_mulai;
  while v_mulai + make_interval(mins => v_durasi) <= v_jadwal.jam_selesai loop
    v_selesai := v_mulai + make_interval(mins => v_durasi);
    if exists (
      select 1 from public.booking b
      where b.mitra_id = p_mitra_id and b.tanggal = p_tanggal
        and b.status <> 'dibatalkan'
        and b.jam_mulai < v_selesai and b.jam_selesai > v_mulai
    ) then
      v_status := 'terisi';
    elsif (
      (v_jadwal.istirahat_mulai is not null
        and v_mulai < v_jadwal.istirahat_selesai
        and v_selesai > v_jadwal.istirahat_mulai)
      or exists (
        select 1 from public.penutupan_jadwal j
        where j.mitra_id = p_mitra_id and j.tanggal = p_tanggal
          and j.jam_mulai < v_selesai and j.jam_selesai > v_mulai
      )
    ) then
      v_status := 'ditutup';
    elsif p_tanggal < v_now::date
      or (p_tanggal = v_now::date and v_mulai <= v_now::time) then
      v_status := 'lewat';
    else
      v_status := 'kosong';
    end if;

    jam_mulai := v_mulai;
    jam_selesai := v_selesai;
    status := v_status;
    tersedia := v_status = 'kosong';
    return next;
    v_mulai := v_mulai + interval '30 minutes';
  end loop;
end;
$function$;

drop function if exists public.create_booking(uuid, uuid, date, time, text, text);
drop function if exists public.create_booking(uuid, uuid, date, time, text, text, integer);
create function public.create_booking(
  p_mitra_id uuid,
  p_layanan_id uuid,
  p_tanggal date,
  p_jam_mulai time,
  p_nama text,
  p_telepon text,
  p_jumlah_orang integer default 1
)
returns table (
  booking_id uuid, kode text, tanggal date, jam_mulai time,
  jam_selesai time, status text, jumlah_orang integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_jadwal public.jadwal_mingguan%rowtype;
  v_durasi_satu integer;
  v_durasi_total integer;
  v_selesai time;
  v_booking_id uuid;
  v_kode text;
  v_now timestamp;
begin
  if p_jumlah_orang not between 1 and 12 then
    raise exception 'Jumlah orang harus antara 1 sampai 12.';
  end if;
  if p_nama is null or length(trim(p_nama)) not between 2 and 80 then
    raise exception 'Nama pemesan harus 2 sampai 80 karakter.';
  end if;
  if p_telepon is null or length(regexp_replace(p_telepon, '[^0-9]', '', 'g')) not between 10 and 15 then
    raise exception 'Nomor telepon tidak valid.';
  end if;
  v_now := now() at time zone 'Asia/Jakarta';
  if p_tanggal < v_now::date then raise exception 'Tanggal booking sudah lewat.'; end if;

  perform 1 from public.mitra m where m.id = p_mitra_id and m.is_active for update;
  if not found then raise exception 'Mitra tidak ditemukan atau tidak aktif.'; end if;

  select j.* into v_jadwal from public.jadwal_mingguan j
  where j.mitra_id = p_mitra_id
    and j.hari = extract(dow from p_tanggal)::smallint
    and j.buka;
  if not found then raise exception 'Mitra tutup pada tanggal tersebut.'; end if;

  select l.durasi into v_durasi_satu
  from public.layanan l
  where l.id = p_layanan_id and l.mitra_id = p_mitra_id;
  if not found then raise exception 'Layanan tidak ditemukan.'; end if;

  v_durasi_total := v_durasi_satu * p_jumlah_orang;
  v_selesai := p_jam_mulai + make_interval(mins => v_durasi_total);
  if p_jam_mulai < v_jadwal.jam_mulai or v_selesai > v_jadwal.jam_selesai
    or mod(extract(epoch from (p_jam_mulai - v_jadwal.jam_mulai))::integer, 1800) <> 0 then
    raise exception 'Waktu booking di luar jadwal yang tersedia.';
  end if;
  if p_tanggal = v_now::date and p_jam_mulai <= v_now::time then
    raise exception 'Waktu booking sudah lewat.';
  end if;
  if v_jadwal.istirahat_mulai is not null
    and p_jam_mulai < v_jadwal.istirahat_selesai
    and v_selesai > v_jadwal.istirahat_mulai then
    raise exception 'Booking rombongan melewati jam istirahat.';
  end if;
  if exists (
    select 1 from public.booking b
    where b.mitra_id = p_mitra_id and b.tanggal = p_tanggal
      and b.status <> 'dibatalkan'
      and b.jam_mulai < v_selesai and b.jam_selesai > p_jam_mulai
  ) then
    raise exception 'Slot baru saja dipesan. Silakan pilih waktu lain.';
  end if;
  if exists (
    select 1 from public.penutupan_jadwal j
    where j.mitra_id = p_mitra_id and j.tanggal = p_tanggal
      and j.jam_mulai < v_selesai and j.jam_selesai > p_jam_mulai
  ) then
    raise exception 'Slot sedang ditutup. Silakan pilih waktu lain.';
  end if;

  v_booking_id := gen_random_uuid();
  v_kode := 'NB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  return query
  insert into public.booking as b (
    id, mitra_id, layanan_id, kode, nama, telepon, tanggal,
    jam_mulai, jam_selesai, status, jumlah_orang, durasi_menit
  )
  values (
    v_booking_id, p_mitra_id, p_layanan_id, v_kode, trim(p_nama), p_telepon,
    p_tanggal, p_jam_mulai, v_selesai, 'menunggu', p_jumlah_orang, v_durasi_total
  )
  returning b.id, b.kode, b.tanggal, b.jam_mulai, b.jam_selesai, b.status, b.jumlah_orang;
end;
$function$;

create or replace function public.tutup_jam(
  p_mitra_id uuid, p_tanggal date, p_jam_mulai time, p_jam_selesai time
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_jadwal public.jadwal_mingguan%rowtype;
begin
  perform 1
  from public.mitra m
  where m.id = p_mitra_id and m.auth_user_id = (select auth.uid()) and m.is_active
  for update;
  if not found then
    raise exception 'Mitra tidak ditemukan atau akses ditolak.';
  end if;
  select j.* into v_jadwal from public.jadwal_mingguan j
  where j.mitra_id = p_mitra_id and j.hari = extract(dow from p_tanggal)::smallint and j.buka;
  if not found or p_jam_selesai <= p_jam_mulai
    or p_jam_mulai < v_jadwal.jam_mulai or p_jam_selesai > v_jadwal.jam_selesai
    or mod(extract(epoch from (p_jam_mulai - v_jadwal.jam_mulai))::integer, 1800) <> 0
    or mod(extract(epoch from (p_jam_selesai - v_jadwal.jam_mulai))::integer, 1800) <> 0 then
    raise exception 'Rentang penutupan harus mengikuti slot 30 menit pada jam buka.';
  end if;
  if exists (
    select 1 from public.booking b
    where b.mitra_id = p_mitra_id and b.tanggal = p_tanggal
      and b.status <> 'dibatalkan'
      and b.jam_mulai < p_jam_selesai and b.jam_selesai > p_jam_mulai
  ) then raise exception 'Rentang waktu memiliki booking aktif dan tidak dapat ditutup.'; end if;
  insert into public.penutupan_jadwal (mitra_id, tanggal, jam_mulai, jam_selesai)
  values (p_mitra_id, p_tanggal, p_jam_mulai, p_jam_selesai);
end;
$function$;

create or replace function public.buka_jam(
  p_mitra_id uuid, p_tanggal date, p_jam_mulai time, p_jam_selesai time
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.mitra m
    where m.id = p_mitra_id and m.auth_user_id = (select auth.uid()) and m.is_active
  ) then raise exception 'Mitra tidak ditemukan atau akses ditolak.'; end if;
  delete from public.penutupan_jadwal j
  where j.mitra_id = p_mitra_id and j.tanggal = p_tanggal
    and j.jam_mulai < p_jam_selesai and j.jam_selesai > p_jam_mulai;
end;
$function$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.get_jadwal_operasional(uuid) from public, anon, authenticated;
revoke all on function public.admin_create_mitra(text, text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.admin_list_mitra() from public, anon, authenticated;
revoke all on function public.save_jadwal_mingguan(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_slot_tersedia(uuid, uuid, date, integer) from public, anon, authenticated;
revoke all on function public.create_booking(uuid, uuid, date, time, text, text, integer) from public, anon, authenticated;
revoke all on function public.tutup_jam(uuid, date, time, time) from public, anon, authenticated;
revoke all on function public.buka_jam(uuid, date, time, time) from public, anon, authenticated;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.get_jadwal_operasional(uuid) to anon, authenticated;
grant execute on function public.admin_create_mitra(text, text, text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.admin_list_mitra() to authenticated;
grant execute on function public.save_jadwal_mingguan(uuid, jsonb) to authenticated;
grant execute on function public.get_slot_tersedia(uuid, uuid, date, integer) to anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, date, time, text, text, integer) to anon, authenticated;
grant execute on function public.tutup_jam(uuid, date, time, time) to authenticated;
grant execute on function public.buka_jam(uuid, date, time, time) to authenticated;

commit;
