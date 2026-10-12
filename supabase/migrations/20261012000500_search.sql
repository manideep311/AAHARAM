-- Catalog search used by the app's Search screen. Dishes from closed restaurants are excluded
-- (matching Sub-project 1's behaviour); restaurants themselves are always searchable.

create function public.search_catalog(q text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with term as (
    select '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select jsonb_build_object(
    'restaurants', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.rating desc, r.name)
      from public.restaurants r, term
      where r.name ilike term.pattern
         or array_to_string(r.cuisines, ' ') ilike term.pattern
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.rating desc nulls last, m.name)
      from public.menu_items m
      join public.restaurants r on r.id = m.restaurant_id, term
      where r.is_open
        and (m.name ilike term.pattern or m.description ilike term.pattern)
    ), '[]'::jsonb)
  )
$$;
