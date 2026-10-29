-- Optional, destructive cleanup for the original seeded demo businesses.
-- Review the slug list before running. Related bookings, services, hours, and
-- closures are removed by the existing mitra foreign-key cascades.
delete from public.mitra
where slug in ('barbershop-rapi', 'laundry-bersih', 'salon-senja');
