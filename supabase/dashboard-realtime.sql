-- Run after tenant-scheduling.sql to support the updated mitra dashboard.
begin;

alter table public.booking
  add column if not exists dibuat_pada timestamptz not null default now();

do $migration$
declare
  v_table text;
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Publication supabase_realtime tidak ditemukan.';
  end if;

  foreach v_table in array array[
    'booking',
    'layanan',
    'jadwal_mingguan',
    'penutupan_jadwal'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end;
$migration$;

commit;
