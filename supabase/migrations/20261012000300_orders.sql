-- Orders are written only by the Edge Functions (service role) and the tracking job.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id text not null,
  restaurant_id text not null references public.restaurants(id),
  restaurant_name text not null,
  items jsonb not null,
  address jsonb not null,
  delivery_instructions text,
  payment_method text not null check (payment_method in ('upi', 'card', 'netbanking', 'cod')),
  payment_status text not null check (payment_status in ('paid_simulated', 'pending_cod', 'refunded_simulated')),
  status text not null default 'placed' check (status in (
    'placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'failed'
  )),
  subtotal integer not null,
  discount integer not null default 0,
  delivery_fee integer not null default 0,
  tax integer not null default 0,
  total integer not null,
  coupon_code text,
  eta_minutes integer not null,
  placed_at timestamptz not null default now(),
  status_updated_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);
create index orders_user_id_placed_at_idx on public.orders(user_id, placed_at desc);
create index orders_active_idx on public.orders(status) where status not in ('delivered', 'cancelled', 'failed');

alter table public.orders enable row level security;
create policy "Users read own orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.orders from anon, authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_id_created_at_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users mark own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Clients may only set read_at.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

alter publication supabase_realtime add table public.orders, public.notifications;
