-- Server-side tracking simulation: a pg_cron job advances active orders by elapsed time,
-- and a trigger turns every status change into an in-app notification.

create extension if not exists pg_cron with schema pg_catalog;

create function public.order_status_rank(s text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select array_position(
    array['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered'],
    s
  )
$$;

create function public.target_order_status(elapsed interval)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when elapsed >= interval '8 minutes' then 'delivered'
    when elapsed >= interval '6 minutes' then 'out_for_delivery'
    when elapsed >= interval '5 minutes' then 'picked_up'
    when elapsed >= interval '4 minutes' then 'ready'
    when elapsed >= interval '90 seconds' then 'preparing'
    when elapsed >= interval '30 seconds' then 'confirmed'
    else 'placed'
  end
$$;

create function public.advance_order_statuses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  advanced integer;
begin
  update public.orders o
     set status = public.target_order_status(now() - o.placed_at),
         status_updated_at = now()
   where o.status not in ('delivered', 'cancelled', 'failed')
     and public.order_status_rank(public.target_order_status(now() - o.placed_at)) > public.order_status_rank(o.status);
  get diagnostics advanced = row_count;
  return advanced;
end;
$$;

-- Security-definer functions in public are callable through the API by default; this one is
-- for the cron job only.
revoke execute on function public.advance_order_statuses() from public, anon, authenticated;

create function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_title text;
  n_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select x.title, x.body into n_title, n_body
  from (values
    ('confirmed', 'Order confirmed', format('%s has accepted your order.', new.restaurant_name)),
    ('preparing', 'Being prepared', format('%s is preparing your food.', new.restaurant_name)),
    ('ready', 'Ready for pickup', format('Your order from %s is packed and waiting for a rider.', new.restaurant_name)),
    ('picked_up', 'Picked up', format('A rider has picked up your order from %s.', new.restaurant_name)),
    ('out_for_delivery', 'Out for delivery', format('Your order from %s is on its way!', new.restaurant_name)),
    ('delivered', 'Delivered', format('Your order from %s has been delivered. Enjoy!', new.restaurant_name)),
    ('cancelled', 'Order cancelled', format('Your order from %s was cancelled.', new.restaurant_name)),
    ('failed', 'Order failed', format('Something went wrong with your order from %s.', new.restaurant_name))
  ) as x(status, title, body)
  where x.status = new.status;

  if n_title is not null then
    insert into public.notifications (user_id, order_id, title, body)
    values (new.user_id, new.id, n_title, n_body);
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_order_status_change() from public, anon, authenticated;

create trigger orders_status_notify
  after update of status on public.orders
  for each row execute function public.notify_order_status_change();

select cron.schedule('advance-orders', '30 seconds', 'select public.advance_order_statuses()');
