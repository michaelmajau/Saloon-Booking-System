-- Bookify operational schema. Run this in the Supabase SQL editor before using
-- the staff and admin operational endpoints. Monetary values are Kenyan shillings.
create table if not exists public.salon_settings (
  setting_id uuid primary key default gen_random_uuid(),
  salon_name text not null default 'Bookify', location text not null default 'Nairobi, Kenya',
  phone text, email text, opening_time time not null default '09:00', closing_time time not null default '19:00',
  currency text not null default 'KES' check (currency = 'KES'), updated_at timestamptz not null default now()
);
create table if not exists public.appointments (
  appointment_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(user_id) on delete restrict,
  staff_id uuid not null references public.staff(staff_id) on delete restrict,
  service_id uuid not null references public.services(service_id) on delete restrict,
  appointment_date date not null, start_time time not null, end_time time not null,
  status text not null default 'confirmed' check (status in ('pending','confirmed','checked_in','completed','cancelled','no_show')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  total_amount numeric(12,2) not null check (total_amount >= 0), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (end_time > start_time)
);
create index if not exists appointments_staff_day_idx on public.appointments(staff_id, appointment_date, start_time);
create index if not exists appointments_day_idx on public.appointments(appointment_date, start_time);
create unique index if not exists appointments_staff_start_active_idx on public.appointments(staff_id, appointment_date, start_time) where status not in ('cancelled', 'no_show');
insert into public.salon_settings (salon_name, location) select 'Bookify', 'Nairobi, Kenya' where not exists (select 1 from public.salon_settings);
