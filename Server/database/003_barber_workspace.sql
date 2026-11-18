-- Run once in Supabase SQL Editor before using the barber breaks and tips features.
alter table public.appointments
  add column if not exists tip_amount numeric(12,2) not null default 0
  check (tip_amount >= 0);

create table if not exists public.staff_breaks (
  break_id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(staff_id) on delete cascade,
  break_date date not null,
  start_time time not null,
  end_time time not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists staff_breaks_staff_day_idx
  on public.staff_breaks (staff_id, break_date, start_time);

alter table public.staff_breaks enable row level security;
