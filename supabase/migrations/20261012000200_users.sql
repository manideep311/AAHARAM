-- Per-user data: profiles, addresses, favorites. Every row is visible only to its owner.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Only `name` is editable from the app.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (label in ('Home', 'Work', 'Other')),
  recipient_name text not null,
  phone text not null,
  line1 text not null,
  area text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  landmark text,
  instructions text,
  is_default boolean not null default false,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses(user_id);
create unique index addresses_one_default_per_user on public.addresses(user_id) where is_default;

alter table public.addresses enable row level security;
create policy "Users manage own addresses" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Two statements (clear, then set) because the partial unique index is checked row by row.
create function public.set_default_address(address_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.addresses set is_default = false
   where user_id = auth.uid() and is_default and id <> address_id;
  update public.addresses set is_default = true
   where user_id = auth.uid() and id = address_id;
end;
$$;

create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('restaurant', 'menu_item')),
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, target_id)
);

alter table public.favorites enable row level security;
create policy "Users read own favorites" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add own favorites" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users remove own favorites" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));
