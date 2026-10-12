-- Catalog: readable by everyone, writable by nobody through the API.

create table public.restaurants (
  id text primary key,
  name text not null,
  phone text,
  cuisines text[] not null default '{}',
  cover_image_url text not null,
  rating numeric(2,1) not null default 0,
  rating_count integer not null default 0,
  price_range smallint not null check (price_range between 1 and 3),
  eta_minutes integer not null,
  delivery_fee integer not null default 0,
  min_order_amount integer not null default 0,
  is_open boolean not null default true,
  opens_at text not null,
  closes_at text not null,
  offer_ids text[] not null default '{}',
  tags text[] not null default '{}'
);

create table public.menu_categories (
  id text primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);
create index menu_categories_restaurant_id_idx on public.menu_categories(restaurant_id);

create table public.menu_items (
  id text primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  category_id text not null references public.menu_categories(id) on delete cascade,
  name text not null,
  description text not null default '',
  image_url text not null,
  base_price integer not null check (base_price >= 0),
  veg_flag text not null check (veg_flag in ('veg', 'non-veg', 'egg', 'unknown')),
  rating numeric(2,1),
  is_available boolean not null default true,
  option_groups jsonb not null default '[]',
  add_ons jsonb not null default '[]',
  supports_spice_level boolean not null default false,
  popular boolean not null default false
);
create index menu_items_restaurant_id_idx on public.menu_items(restaurant_id);

create table public.offers (
  id text primary key,
  restaurant_id text references public.restaurants(id) on delete cascade,
  title text not null,
  description text not null,
  coupon_code text
);

create table public.coupons (
  code text primary key check (code = upper(code)),
  description text not null,
  type text not null check (type in ('percentage', 'fixed', 'free-delivery')),
  value integer not null default 0,
  min_order_amount integer not null default 0,
  max_discount integer,
  restaurant_id text references public.restaurants(id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.offers enable row level security;
alter table public.coupons enable row level security;

create policy "Catalog is readable by everyone" on public.restaurants for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.menu_categories for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.menu_items for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.offers for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.coupons for select to anon, authenticated using (true);

-- Defense in depth on top of RLS (no write policies exist either).
revoke insert, update, delete on public.restaurants, public.menu_categories, public.menu_items, public.offers, public.coupons
  from anon, authenticated;
