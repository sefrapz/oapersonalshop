-- OA Personalshop uppdatering 1 (säkerhetsrevision K3/M1). Kör i Supabase SQL Editor.

-- 1) Atomär kvotdragning: kontroll och dragning i EN sats — race-säker.
--    Returnerar true om kvoten räckte (och drogs), annars false.
create or replace function consume_quota(
  p_staff_id uuid, p_add_kr int, p_add_items int, p_max_kr int, p_max_items int
) returns boolean language plpgsql as $$
declare updated int;
begin
  update staff set
    used_kr = used_kr + p_add_kr,
    used_items = used_items + p_add_items
  where id = p_staff_id
    and (p_max_kr < 0 or used_kr + p_add_kr <= p_max_kr)
    and (p_max_items < 0 or used_items + p_add_items <= p_max_items);
  get diagnostics updated = row_count;
  return updated = 1;
end $$;

-- Återbetalning om orderinsättningen mot förmodan misslyckas efter dragning
create or replace function refund_quota(
  p_staff_id uuid, p_kr int, p_items int
) returns void language sql as $$
  update staff set
    used_kr = greatest(0, used_kr - p_kr),
    used_items = greatest(0, used_items - p_items)
  where id = p_staff_id;
$$;

-- 2) Index för attest-uppslag (används vid varje attestklick)
create index if not exists orders_attest_token on orders (attest_token) where attest_token <> '';
create index if not exists sessions_expires on sessions (expires_at);
create index if not exists login_tokens_expires on login_tokens (expires_at);

-- 3) RLS default-deny på alla tabeller (service role påverkas ej)
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
