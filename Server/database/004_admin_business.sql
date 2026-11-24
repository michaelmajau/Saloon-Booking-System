begin;

-- These modules follow the existing single-salon, admin-only workspace model.
create table public.inventory_products (
  product_id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 150),
  category text,
  supplier text,
  purchase_price numeric(12,2) not null check (purchase_price >= 0),
  selling_price numeric(12,2) check (selling_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Walk-in contacts are separate from Supabase Auth accounts.
create table public.walk_in_customers (
  customer_id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 1 and 150),
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.pos_sales (
  sale_id uuid primary key,
  registered_customer_id uuid references public.users(user_id) on delete set null,
  walk_in_customer_id uuid references public.walk_in_customers(customer_id) on delete set null,
  recorded_by uuid references public.users(user_id) on delete set null,
  payment_method text not null check (payment_method in ('cash','mpesa','card','bank')),
  total numeric(14,2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  check (registered_customer_id is null or walk_in_customer_id is null)
);

create table public.pos_sale_items (
  sale_id uuid not null references public.pos_sales(sale_id),
  item_kind text not null check (item_kind in ('service','product')),
  item_id uuid not null,
  item_name text not null,
  quantity integer not null check (quantity between 1 and 1000),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  primary key (sale_id, item_kind, item_id)
);

create table public.inventory_movements (
  movement_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(product_id),
  quantity integer not null check (quantity <> 0),
  reason text not null,
  sale_id uuid references public.pos_sales(sale_id),
  recorded_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.business_expenses (
  expense_id uuid primary key,
  category text not null check (length(btrim(category)) between 1 and 100),
  description text not null check (length(btrim(description)) between 1 and 300),
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null,
  recorded_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.admin_notification_preferences (
  user_id uuid primary key references public.users(user_id) on delete cascade,
  preferences jsonb not null check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

create index on public.pos_sales (created_at desc, sale_id);
create index on public.business_expenses (expense_date desc, expense_id);
create index on public.inventory_movements (product_id, created_at desc);
create index on public.pos_sales (registered_customer_id);
create index on public.pos_sales (walk_in_customer_id);

alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.walk_in_customers enable row level security;
alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;
alter table public.business_expenses enable row level security;
alter table public.admin_notification_preferences enable row level security;

revoke all on public.inventory_products, public.inventory_movements, public.walk_in_customers,
  public.pos_sales, public.pos_sale_items, public.business_expenses, public.admin_notification_preferences
  from public, anon, authenticated;
grant select, insert, update on public.inventory_products, public.inventory_movements, public.walk_in_customers,
  public.pos_sales, public.pos_sale_items, public.business_expenses, public.admin_notification_preferences
  to service_role;

create function public.adjust_inventory(p_product uuid, p_quantity integer, p_reason text, p_actor uuid)
returns public.inventory_products language plpgsql set search_path = '' as $$
declare product public.inventory_products;
begin
  update public.inventory_products set stock = stock + p_quantity
  where product_id = p_product and stock::bigint + p_quantity between 0 and 2147483647
  returning * into product;
  if not found then raise exception 'Product unavailable or stock adjustment out of range' using errcode = 'P0001'; end if;
  insert into public.inventory_movements(product_id, quantity, reason, recorded_by)
    values (p_product, p_quantity, p_reason, p_actor);
  return product;
end;
$$;

create function public.record_pos_sale(p_id uuid, p_registered uuid, p_walk_in uuid, p_method text, p_actor uuid, p_items jsonb)
returns public.pos_sales language plpgsql set search_path = '' as $$
declare
  sale public.pos_sales;
  item record;
  item_name text;
  price numeric;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Invalid sale items' using errcode = 'P0001';
  end if;
  if p_registered is not null and not exists (
    select 1 from public.users where user_id = p_registered and role = 'customer'
  ) then raise exception 'Customer unavailable' using errcode = 'P0001'; end if;

  insert into public.pos_sales(sale_id, registered_customer_id, walk_in_customer_id, payment_method, recorded_by, total)
    values (p_id, p_registered, p_walk_in, p_method, p_actor, 0)
    returning * into sale;

  -- Lock stock in a consistent order to serialize concurrent checkouts.
  for item in select * from jsonb_to_recordset(p_items) as x(kind text, id uuid, quantity integer) order by kind, id
  loop
    if item.quantity is null or item.quantity not between 1 and 1000 then
      raise exception 'Invalid quantity' using errcode = 'P0001';
    end if;
    case item.kind
      when 'product' then
        update public.inventory_products set stock = stock - item.quantity
          where product_id = item.id and is_active and selling_price is not null and stock >= item.quantity
          returning name, selling_price into item_name, price;
        if not found then raise exception 'Product unavailable or insufficient stock' using errcode = 'P0001'; end if;
        insert into public.inventory_movements(product_id, quantity, reason, sale_id, recorded_by)
          values (item.id, -item.quantity, 'POS sale', p_id, p_actor);
      when 'service' then
        select service_name, services.price into item_name, price from public.services where service_id = item.id;
        if not found then raise exception 'Service unavailable' using errcode = 'P0001'; end if;
      else raise exception 'Invalid item type' using errcode = 'P0001';
    end case;
    insert into public.pos_sale_items(sale_id, item_kind, item_id, item_name, quantity, unit_price)
      values (p_id, item.kind, item.id, item_name, item.quantity, price);
  end loop;

  update public.pos_sales set total = (
    select sum(quantity * unit_price) from public.pos_sale_items where sale_id = p_id
  ) where sale_id = p_id returning * into sale;
  return sale;
end;
$$;

create view public.admin_transaction_ledger with (security_invoker = true) as
  select sale_id as reference, 'pos'::text as source, created_at,
    (created_at at time zone 'Africa/Nairobi')::date as transaction_date, total as amount,
    payment_method, 'paid'::text as payment_status, registered_customer_id, walk_in_customer_id
  from public.pos_sales
  union all
  select appointment_id, 'appointment', created_at, appointment_date, coalesce(total_amount, 0),
    null::text, coalesce(payment_status, 'unpaid'), customer_id, null::uuid
  from public.appointments where status not in ('cancelled', 'no_show') or payment_status in ('paid', 'refunded');

create view public.admin_customer_directory with (security_invoker = true) as
  select user_id as customer_id, 'registered'::text as kind, full_name, email::text, phone::text,
    (select count(*) from public.appointments a where a.customer_id = u.user_id and a.status = 'completed') as visits,
    coalesce((select sum(amount) from public.admin_transaction_ledger t where t.registered_customer_id = u.user_id and t.payment_status = 'paid'), 0) as lifetime_value
  from public.users u where role = 'customer'
  union all
  select customer_id, 'walk_in', full_name, email, phone, 0::bigint,
    coalesce((select sum(amount) from public.admin_transaction_ledger t where t.walk_in_customer_id = c.customer_id and t.payment_status = 'paid'), 0)
  from public.walk_in_customers c;

create function public.admin_finance_summary(p_from date, p_to date)
returns table(gross_revenue numeric, total_expenses numeric, net_income numeric, outstanding numeric)
language sql stable set search_path = '' as $$
  with ledger as (
    select coalesce(sum(amount) filter (where payment_status = 'paid'), 0) as paid,
      coalesce(sum(amount) filter (where payment_status = 'unpaid'), 0) as unpaid
    from public.admin_transaction_ledger where transaction_date between p_from and p_to
  ), expenses as (
    select coalesce(sum(amount), 0) as spent from public.business_expenses where expense_date between p_from and p_to
  )
  select paid, spent, paid - spent, unpaid from ledger cross join expenses;
$$;

revoke all on public.admin_transaction_ledger, public.admin_customer_directory from public, anon, authenticated;
grant select on public.admin_transaction_ledger, public.admin_customer_directory to service_role;
revoke all on function public.adjust_inventory(uuid, integer, text, uuid),
  public.record_pos_sale(uuid, uuid, uuid, text, uuid, jsonb), public.admin_finance_summary(date, date)
  from public, anon, authenticated;
grant execute on function public.adjust_inventory(uuid, integer, text, uuid),
  public.record_pos_sale(uuid, uuid, uuid, text, uuid, jsonb), public.admin_finance_summary(date, date)
  to service_role;

commit;
