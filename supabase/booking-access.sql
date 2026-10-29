-- Run after the base tables exist and mitra.auth_user_id is linked to auth.users.
-- Public clients can read shop/service listings and available slot labels only.
-- Booking writes go through create_booking(), which serializes requests per shop.

begin;

alter table public.mitra enable row level security;
alter table public.layanan enable row level security;
alter table public.booking enable row level security;
alter table public.penutupan_jadwal enable row level security;

drop policy if exists "public can read mitra booking profile" on public.mitra;
drop policy if exists "public can read services" on public.layanan;
drop policy if exists "mitra can read own profile" on public.mitra;
drop policy if exists "mitra can read own services" on public.layanan;
drop policy if exists "mitra can add own services" on public.layanan;
drop policy if exists "mitra can edit own services" on public.layanan;
drop policy if exists "mitra can remove own services" on public.layanan;
drop policy if exists "mitra can read own bookings" on public.booking;
drop policy if exists "mitra can update own booking status" on public.booking;
drop policy if exists "mitra can read own closures" on public.penutupan_jadwal;

revoke all privileges on table public.mitra, public.layanan, public.booking, public.penutupan_jadwal
from anon, authenticated, public;
revoke select (id, slug, nama, kategori, alamat, telepon, jam_mulai, jam_selesai)
on public.mitra from anon;

grant select (id, slug, nama, kategori, alamat, telepon, jam_mulai, jam_selesai)
on public.mitra to anon;
grant select (id, slug, nama, kategori, alamat, telepon, jam_mulai, jam_selesai, auth_user_id)
on public.mitra to authenticated;
grant select on public.layanan to anon, authenticated;
grant insert, update, delete on public.layanan to authenticated;
grant select on public.booking to authenticated;
grant update (status) on public.booking to authenticated;
grant select on public.penutupan_jadwal to authenticated;

create policy "public can read mitra booking profile"
on public.mitra for select to anon using (true);

create policy "mitra can read own profile"
on public.mitra for select to authenticated
using (auth_user_id = (select auth.uid()));

create policy "public can read services"
on public.layanan for select to anon using (true);

create policy "mitra can read own services"
on public.layanan for select to authenticated
using (
  exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
);

create policy "mitra can add own services"
on public.layanan for insert to authenticated
with check (
  exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
);

create policy "mitra can edit own services"
on public.layanan for update to authenticated
using (
  exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
);

create policy "mitra can remove own services"
on public.layanan for delete to authenticated
using (
  exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
);

create policy "mitra can read own bookings"
on public.booking for select to authenticated
using (
  exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
);

create policy "mitra can update own booking status"
on public.booking for update to authenticated
using (
  exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
)
with check (
  status in ('menunggu', 'diterima', 'dibatalkan')
  and exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
);

create policy "mitra can read own closures"
on public.penutupan_jadwal for select to authenticated
using (
  exists (
    select 1 from public.mitra m
    where m.id = mitra_id and m.auth_user_id = (select auth.uid())
  )
);

create or replace function public.get_slot_tersedia(
  p_mitra_id uuid,
  p_layanan_id uuid,
  p_tanggal date
)
returns table (jam_mulai time, jam_selesai time, status text, tersedia boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_buka time;
  v_tutup time;
  v_durasi integer;
  v_mulai time;
  v_selesai time;
  v_status text;
  v_is_past boolean;
begin
  select m.jam_mulai, m.jam_selesai
  into v_buka, v_tutup
  from public.mitra m
  where m.id = p_mitra_id;

  if not found then
    raise exception 'Mitra tidak ditemukan.';
  end if;

  select l.durasi
  into v_durasi
  from public.layanan l
  where l.id = p_layanan_id and l.mitra_id = p_mitra_id;

  if not found then
    raise exception 'Layanan tidak ditemukan.';
  end if;

  v_mulai := v_buka;
  while v_mulai + make_interval(mins => v_durasi) <= v_tutup loop
    v_selesai := v_mulai + make_interval(mins => v_durasi);
    v_is_past := p_tanggal < (now() at time zone 'Asia/Jakarta')::date
      or (
        p_tanggal = (now() at time zone 'Asia/Jakarta')::date
        and v_mulai <= (now() at time zone 'Asia/Jakarta')::time
      );

    if exists (
      select 1 from public.booking b
      where b.mitra_id = p_mitra_id
        and b.tanggal = p_tanggal
        and b.status <> 'dibatalkan'
        and b.jam_mulai < v_selesai
        and b.jam_selesai > v_mulai
    ) then
      v_status := 'terisi';
    elsif exists (
      select 1 from public.penutupan_jadwal j
      where j.mitra_id = p_mitra_id
        and j.tanggal = p_tanggal
        and j.jam_mulai < v_selesai
        and j.jam_selesai > v_mulai
    ) then
      v_status := 'ditutup';
    elsif v_is_past then
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

create or replace function public.create_booking(
  p_mitra_id uuid,
  p_layanan_id uuid,
  p_tanggal date,
  p_jam_mulai time,
  p_nama text,
  p_telepon text
)
returns table (booking_id uuid, kode text, tanggal date, jam_mulai time, jam_selesai time, status text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_buka time;
  v_tutup time;
  v_durasi integer;
  v_selesai time;
  v_booking_id uuid;
  v_kode text;
begin
  if p_nama is null or length(trim(p_nama)) < 2 or length(trim(p_nama)) > 80 then
    raise exception 'Nama pemesan harus 2 sampai 80 karakter.';
  end if;
  if p_telepon is null or length(regexp_replace(p_telepon, '[^0-9]', '', 'g')) not between 10 and 15 then
    raise exception 'Nomor telepon tidak valid.';
  end if;
  if p_tanggal < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal booking sudah lewat.';
  end if;

  -- Serialize booking attempts for this shop to prevent simultaneous double booking.
  select m.jam_mulai, m.jam_selesai
  into v_buka, v_tutup
  from public.mitra m
  where m.id = p_mitra_id
  for update;

  if not found then
    raise exception 'Mitra tidak ditemukan.';
  end if;

  select l.durasi
  into v_durasi
  from public.layanan l
  where l.id = p_layanan_id and l.mitra_id = p_mitra_id;

  if not found then
    raise exception 'Layanan tidak ditemukan.';
  end if;

  v_selesai := p_jam_mulai + make_interval(mins => v_durasi);
  if p_jam_mulai < v_buka or v_selesai > v_tutup
    or mod(extract(epoch from (p_jam_mulai - v_buka))::integer, 1800) <> 0 then
    raise exception 'Waktu booking di luar jadwal yang tersedia.';
  end if;

  if p_tanggal = (now() at time zone 'Asia/Jakarta')::date
    and p_jam_mulai <= (now() at time zone 'Asia/Jakarta')::time then
    raise exception 'Waktu booking sudah lewat.';
  end if;

  if exists (
    select 1 from public.booking b
    where b.mitra_id = p_mitra_id
      and b.tanggal = p_tanggal
      and b.status <> 'dibatalkan'
      and b.jam_mulai < v_selesai
      and b.jam_selesai > p_jam_mulai
  ) then
    raise exception 'Slot baru saja dipesan. Silakan pilih waktu lain.';
  end if;

  if exists (
    select 1 from public.penutupan_jadwal j
    where j.mitra_id = p_mitra_id
      and j.tanggal = p_tanggal
      and j.jam_mulai < v_selesai
      and j.jam_selesai > p_jam_mulai
  ) then
    raise exception 'Slot sedang ditutup. Silakan pilih waktu lain.';
  end if;

  v_booking_id := gen_random_uuid();
  v_kode := 'NB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  return query
  insert into public.booking as b (
    id, mitra_id, layanan_id, kode, nama, telepon,
    tanggal, jam_mulai, jam_selesai, status
  )
  values (
    v_booking_id, p_mitra_id, p_layanan_id, v_kode, trim(p_nama), p_telepon,
    p_tanggal, p_jam_mulai, v_selesai, 'menunggu'
  )
  returning b.id, b.kode, b.tanggal, b.jam_mulai, b.jam_selesai, b.status;
end;
$function$;

create or replace function public.tutup_jam(
  p_mitra_id uuid,
  p_tanggal date,
  p_jam_mulai time,
  p_jam_selesai time
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_buka time;
  v_tutup time;
begin
  select m.jam_mulai, m.jam_selesai
  into v_buka, v_tutup
  from public.mitra m
  where m.id = p_mitra_id and m.auth_user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Mitra tidak ditemukan atau akses ditolak.';
  end if;
  if p_jam_selesai <= p_jam_mulai or p_jam_mulai < v_buka or p_jam_selesai > v_tutup
    or mod(extract(epoch from (p_jam_mulai - v_buka))::integer, 1800) <> 0
    or mod(extract(epoch from (p_jam_selesai - v_buka))::integer, 1800) <> 0 then
    raise exception 'Rentang penutupan harus mengikuti slot 30 menit dalam jam operasional.';
  end if;
  if exists (
    select 1 from public.booking b
    where b.mitra_id = p_mitra_id and b.tanggal = p_tanggal
      and b.status <> 'dibatalkan'
      and b.jam_mulai < p_jam_selesai and b.jam_selesai > p_jam_mulai
  ) then
    raise exception 'Rentang waktu memiliki booking aktif dan tidak dapat ditutup.';
  end if;

  insert into public.penutupan_jadwal (mitra_id, tanggal, jam_mulai, jam_selesai)
  values (p_mitra_id, p_tanggal, p_jam_mulai, p_jam_selesai);
end;
$function$;

create or replace function public.buka_jam(
  p_mitra_id uuid,
  p_tanggal date,
  p_jam_mulai time,
  p_jam_selesai time
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.mitra m
    where m.id = p_mitra_id and m.auth_user_id = (select auth.uid())
  ) then
    raise exception 'Mitra tidak ditemukan atau akses ditolak.';
  end if;

  delete from public.penutupan_jadwal j
  where j.mitra_id = p_mitra_id and j.tanggal = p_tanggal
    and j.jam_mulai < p_jam_selesai and j.jam_selesai > p_jam_mulai;
end;
$function$;

revoke all on function public.get_slot_tersedia(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.create_booking(uuid, uuid, date, time, text, text) from public, anon, authenticated;
revoke all on function public.tutup_jam(uuid, date, time, time) from public, anon, authenticated;
revoke all on function public.buka_jam(uuid, date, time, time) from public, anon, authenticated;

grant execute on function public.get_slot_tersedia(uuid, uuid, date) to anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, date, time, text, text) to anon, authenticated;
grant execute on function public.tutup_jam(uuid, date, time, time) to authenticated;
grant execute on function public.buka_jam(uuid, date, time, time) to authenticated;

commit;
