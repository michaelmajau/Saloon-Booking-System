-- =============================================================================
-- Bookify — Salon Booking System
-- Database schema (PostgreSQL on Supabase)
--
-- This file recreates the full database structure as it exists in the
-- Supabase project: 8 tables, their keys and rules, indexes, row level
-- security (RLS) and the trigger that creates a profile for each new account.
--
-- How to use: Supabase → SQL Editor → paste this file → Run.
-- Safe to run more than once (it skips anything that already exists).
-- Then run 002_improvements.sql for the security and data-quality fixes.
--
-- Money is stored in Kenyan shillings (KES). Times use the salon's local time.
-- =============================================================================

-- Needed for the "no overlapping bookings" rule on appointments (section 6).
create extension if not exists btree_gist;


-- -----------------------------------------------------------------------------
-- Entity relationships (one → many unless stated)
--
--   auth.users   1 ── 1  users            every login account has one profile
--   users        1 ── 0..1 staff          a profile may belong to a barber/stylist
--   users        1 ── *  appointments     as the customer who booked
--   staff        1 ── *  appointments     as the professional booked
--   services     1 ── *  appointments     the service booked
--   staff        * ── *  services         through staff_services (who offers what)
--   staff        1 ── *  staff_schedules  working hours per day of the week
--   auth.users   1 ── *  audit_logs       who made each recorded change
--   salon_settings                        a single row of salon-wide settings
-- -----------------------------------------------------------------------------


-- =============================================================================
-- 1. users — one profile per login account (customers, staff and admins)
--    The login itself (email + hashed password) lives in Supabase's auth.users.
-- =============================================================================
create table if not exists public.users (
  user_id    uuid              not null default gen_random_uuid(),
  full_name  character varying not null default ''::character varying,
  email      character varying,
  phone      character varying,
  role       character varying not null default 'customer'::character varying,
  constraint "Users_pkey"      primary key (user_id),
  constraint "Users_email_key" unique (email),
  constraint "Users_phone_key" unique (phone),
  constraint users_role_check  check (role in ('admin', 'staff', 'customer')),
  constraint users_auth_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);


-- =============================================================================
-- 2. services — the salon's catalogue (price in KES, duration in minutes)
-- =============================================================================
create table if not exists public.services (
  service_id       uuid              not null default gen_random_uuid(),
  service_name     character varying not null,
  price            numeric           not null,
  duration_minutes integer           not null,
  constraint services_pkey primary key (service_id)
);


-- =============================================================================
-- 3. staff — barbers and stylists. Linked to their profile through user_id.
--    staff_id is the staff record's own ID; appointments point to staff_id.
-- =============================================================================
create table if not exists public.staff (
  staff_id       uuid              not null default gen_random_uuid(),
  specialization character varying,                 -- older column; the app uses `specialty`
  user_id        uuid              not null default gen_random_uuid(),
  is_active      boolean           not null default true,
  specialty      text,
  staff_type     text              not null default 'barber'::text,   -- 'barber' or 'stylist'
  constraint staff_pkey         primary key (staff_id),
  constraint staff_user_id_key  unique (user_id),
  constraint staff_user_id_fkey foreign key (user_id) references public.users (user_id)
);


-- =============================================================================
-- 4. staff_schedules — working hours for a staff member on a day of the week
-- =============================================================================
create table if not exists public.staff_schedules (
  schedule_id  uuid    not null default gen_random_uuid(),
  staff_id     uuid    not null default gen_random_uuid(),
  days_of_week integer not null,                    -- 0 = Sunday … 6 = Saturday
  start_time   time without time zone not null,
  end_time     time without time zone not null,
  constraint staff_schedules_pkey          primary key (schedule_id),
  constraint staff_schedules_staff_id_fkey foreign key (staff_id) references public.staff (staff_id)
);


-- =============================================================================
-- 5. staff_services — which services each staff member offers (many-to-many)
-- =============================================================================
create table if not exists public.staff_services (
  staff_id   uuid not null default gen_random_uuid(),
  service_id uuid not null default gen_random_uuid(),
  constraint staff_services_pkey            primary key (staff_id),   -- see 002_improvements.sql
  constraint staff_services_staff_id_fkey   foreign key (staff_id)   references public.staff (staff_id),
  constraint staff_services_service_id_fkey foreign key (service_id) references public.services (service_id)
);


-- =============================================================================
-- 6. appointments — the main transaction: a customer booking a service
--    with a staff member at a date and time
-- =============================================================================
create table if not exists public.appointments (
  appointment_id   uuid              not null default gen_random_uuid(),
  customer_id      uuid              not null default gen_random_uuid(),
  staff_id         uuid              not null default gen_random_uuid(),
  service_id       uuid              not null default gen_random_uuid(),
  start_time       time without time zone not null,
  end_time         time without time zone not null,
  status           character varying not null default 'confirmed'::character varying,
      -- pending | confirmed | checked_in | completed | cancelled | no_show
  appointment_date date,
  payment_status   text default 'unpaid'::text,     -- unpaid | paid | refunded
  total_amount     numeric(12,2) default 0,          -- KES, copied from the service price when booked
  notes            text,
  created_at       timestamp with time zone default now(),
  updated_at       timestamp with time zone default now(),
  constraint appointments_pkey             primary key (appointment_id),
  constraint appointments_customer_id_fkey foreign key (customer_id) references public.users (user_id),
  constraint appointments_staff_id_fkey    foreign key (staff_id)    references public.staff (staff_id),
  constraint appointments_service_id_fkey  foreign key (service_id)  references public.services (service_id),
  -- No double-booking: a staff member's active bookings may not overlap in time.
  constraint no_double_booking exclude using gist (
    staff_id with =,
    tsrange(appointment_date + start_time, appointment_date + end_time) with &&
  ) where (status in ('pending', 'confirmed', 'checked_in', 'completed'))
);

-- Fast look-ups of a staff member's day, and of a whole day.
create index if not exists appointments_staff_day_idx
  on public.appointments using btree (staff_id, appointment_date, start_time);
create index if not exists appointments_day_idx
  on public.appointments using btree (appointment_date, start_time);

-- Also blocks two active bookings with the same staff member and start time.
create unique index if not exists appointments_staff_start_active_idx
  on public.appointments using btree (staff_id, appointment_date, start_time)
  where status not in ('cancelled', 'no_show');


-- =============================================================================
-- 7. salon_settings — a single row of salon-wide settings
-- =============================================================================
create table if not exists public.salon_settings (
  setting_id   uuid not null default gen_random_uuid(),
  salon_name   text not null default 'Bookify'::text,
  location     text not null default 'Nairobi, Kenya'::text,
  phone        text,
  email        text,
  opening_time time without time zone not null default '09:00:00',
  closing_time time without time zone not null default '19:00:00',
  currency     text not null default 'KES'::text,
  updated_at   timestamp with time zone not null default now(),
  constraint salon_settings_pkey           primary key (setting_id),
  constraint salon_settings_currency_check check (currency = 'KES')
);

-- Create the settings row if there isn't one yet.
insert into public.salon_settings (salon_name, location)
select 'Bookify', 'Nairobi, Kenya'
where not exists (select 1 from public.salon_settings);


-- =============================================================================
-- 8. audit_logs — who changed what and when (written by the server)
-- =============================================================================
create table if not exists public.audit_logs (
  id          uuid not null default gen_random_uuid(),
  user_id     uuid,                       -- who did it (null if that account was deleted)
  action      text not null,              -- e.g. CREATE_APPOINTMENT, UPDATE_SERVICE
  entity_type text not null,              -- e.g. appointments, services, staff
  entity_id   text,
  old_data    jsonb,                      -- values before the change
  new_data    jsonb,                      -- values after the change
  created_at  timestamp with time zone default now(),
  constraint audit_logs_pkey         primary key (id),
  constraint audit_logs_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null
);

create index if not exists audit_logs_entity_idx
  on public.audit_logs using btree (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_created_at_idx
  on public.audit_logs using btree (created_at desc);


-- =============================================================================
-- New accounts: create a customer profile automatically when someone signs up
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.users (user_id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email, 'customer');
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- Row level security (RLS)
-- RLS is on for every table. The website (publishable key) may only read a
-- person's own profile and staff record; everything else goes through the
-- server, which uses the secret key.
-- =============================================================================
alter table public.users           enable row level security;
alter table public.services        enable row level security;
alter table public.staff           enable row level security;
alter table public.staff_schedules enable row level security;
alter table public.staff_services  enable row level security;
alter table public.appointments    enable row level security;
alter table public.salon_settings  enable row level security;
alter table public.audit_logs      enable row level security;

drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users
  as permissive for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
  as permissive for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
  -- NOTE: on its own this policy lets people change their own `role`.
  -- 002_improvements.sql limits it to name and phone.

drop policy if exists "Staff can view their own staff profile" on public.staff;
create policy "Staff can view their own staff profile" on public.staff
  as permissive for select to authenticated
  using (user_id = auth.uid());
