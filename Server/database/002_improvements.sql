-- =============================================================================
-- Bookify — 002_improvements.sql
-- Security and data-quality fixes for the schema in schema.sql.
--
-- Run in Supabase → SQL Editor AFTER schema.sql. Safe to run more than once.
-- It does not delete or change any existing rows.
--
-- New rules below are added as NOT VALID: they apply to every new or edited
-- row straight away, but existing rows are not re-checked, so this script
-- cannot fail because of old data. (Section 5 shows how to check old rows.)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. SECURITY: stop people from changing their own role (e.g. to 'admin')
--
-- The policy "Users can update own profile" lets a signed-in user update their
-- own row in `users`, including the `role` column. Anyone could make
-- themselves an admin using the website's public key.
-- Fix: signed-in users may only update their own name and phone. Roles are
-- changed only by the server (secret key) or in the Supabase dashboard.
-- -----------------------------------------------------------------------------
revoke update on public.users from anon, authenticated;
grant  update (full_name, phone) on public.users to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Remove random default values from foreign-key columns
--
-- These columns default to a brand-new random ID, which can never match a
-- real customer, staff member or service. A missing value should be an error,
-- not a random ID.
-- -----------------------------------------------------------------------------
alter table public.appointments    alter column customer_id drop default;
alter table public.appointments    alter column staff_id    drop default;
alter table public.appointments    alter column service_id  drop default;
alter table public.staff           alter column user_id     drop default;
alter table public.staff_schedules alter column staff_id    drop default;
alter table public.staff_services  alter column staff_id    drop default;
alter table public.staff_services  alter column service_id  drop default;


-- -----------------------------------------------------------------------------
-- 3. staff_services: allow a staff member to offer more than one service
--
-- Its primary key is only (staff_id), so each staff member can be linked to
-- just one service. A many-to-many link table needs both columns in the key.
-- (Every existing row stays valid: staff_id was already unique.)
-- -----------------------------------------------------------------------------
alter table public.staff_services drop constraint if exists staff_services_pkey;
alter table public.staff_services add  constraint staff_services_pkey primary key (staff_id, service_id);
create index if not exists staff_services_service_idx on public.staff_services (service_id);


-- -----------------------------------------------------------------------------
-- 4. Rules that keep the data sensible (the server already checks these;
--    the database now enforces them too)
-- -----------------------------------------------------------------------------
do $$
begin
  -- appointments
  if not exists (select 1 from pg_constraint where conname = 'appointments_status_check') then
    alter table public.appointments add constraint appointments_status_check
      check (status in ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_payment_status_check') then
    alter table public.appointments add constraint appointments_payment_status_check
      check (payment_status in ('unpaid', 'paid', 'refunded')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_time_order_check') then
    alter table public.appointments add constraint appointments_time_order_check
      check (end_time > start_time) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_amount_check') then
    alter table public.appointments add constraint appointments_amount_check
      check (total_amount >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_date_required_check') then
    alter table public.appointments add constraint appointments_date_required_check
      check (appointment_date is not null) not valid;
  end if;

  -- services
  if not exists (select 1 from pg_constraint where conname = 'services_price_check') then
    alter table public.services add constraint services_price_check
      check (price >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_duration_check') then
    alter table public.services add constraint services_duration_check
      check (duration_minutes >= 5) not valid;
  end if;

  -- staff
  if not exists (select 1 from pg_constraint where conname = 'staff_type_check') then
    alter table public.staff add constraint staff_type_check
      check (staff_type in ('barber', 'stylist')) not valid;
  end if;

  -- staff_schedules
  if not exists (select 1 from pg_constraint where conname = 'staff_schedules_day_check') then
    alter table public.staff_schedules add constraint staff_schedules_day_check
      check (days_of_week between 0 and 6) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_schedules_time_order_check') then
    alter table public.staff_schedules add constraint staff_schedules_time_order_check
      check (end_time > start_time) not valid;
  end if;
end $$;

create index if not exists staff_schedules_staff_idx on public.staff_schedules (staff_id);

commit;


-- -----------------------------------------------------------------------------
-- 5. OPTIONAL — check existing rows, then mark the rules as fully valid
--
-- Run each SELECT on its own. If it returns no rows, run the ALTER below it.
-- If it returns rows, fix those rows first (e.g. in the Table Editor).
-- -----------------------------------------------------------------------------
-- select appointment_id, status, payment_status, start_time, end_time, total_amount, appointment_date
--   from public.appointments
--  where status not in ('pending','confirmed','checked_in','completed','cancelled','no_show')
--     or payment_status not in ('unpaid','paid','refunded')
--     or end_time <= start_time or total_amount < 0 or appointment_date is null;
-- alter table public.appointments validate constraint appointments_status_check;
-- alter table public.appointments validate constraint appointments_payment_status_check;
-- alter table public.appointments validate constraint appointments_time_order_check;
-- alter table public.appointments validate constraint appointments_amount_check;
-- alter table public.appointments validate constraint appointments_date_required_check;
--
-- select service_id, service_name, price, duration_minutes from public.services
--  where price < 0 or duration_minutes < 5;
-- alter table public.services validate constraint services_price_check;
-- alter table public.services validate constraint services_duration_check;
--
-- select staff_id, staff_type from public.staff where staff_type not in ('barber','stylist');
-- alter table public.staff validate constraint staff_type_check;


-- -----------------------------------------------------------------------------
-- 6. For the team to decide (not run automatically)
--
-- staff.specialization duplicates staff.specialty; the app only uses
-- `specialty`. Once you've confirmed `specialization` holds nothing you need:
--   alter table public.staff drop column specialization;
-- -----------------------------------------------------------------------------
