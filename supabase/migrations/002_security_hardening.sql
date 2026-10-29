-- Security hardening: least-privilege grants, per-account limits, a bounded import, and plain-language
-- notes on every row-level security policy. Changes no existing rows and no policy logic.

-- 1. Least privilege ---------------------------------------------------------------------------
-- The signed-in role only needs to read and write rows. TRUNCATE ignores row-level security (it would
-- empty a table for every user), and REFERENCES / TRIGGER are never needed by the app.
revoke all on public.boards, public.cards from anon, public;
revoke truncate, references, trigger on public.boards, public.cards from authenticated;

-- A trigger function is fired by the database; nobody needs permission to call it directly.
revoke execute on function public.set_updated_at() from public, anon, authenticated, service_role;

-- 2. Per-account limits ------------------------------------------------------------------------
-- Stops one account from filling the database. Raise the numbers here if real use needs more.
create function public.enforce_board_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.boards where user_id = new.user_id) >= 100 then
    raise exception 'Board limit reached (100 per account)';
  end if;
  return new;
end;
$$;

create function public.enforce_card_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.cards where user_id = new.user_id) >= 5000 then
    raise exception 'Card limit reached (5000 per account)';
  end if;
  return new;
end;
$$;

create trigger boards_enforce_quota before insert on public.boards
  for each row execute function public.enforce_board_quota();
create trigger cards_enforce_quota before insert on public.cards
  for each row execute function public.enforce_card_quota();

revoke execute on function public.enforce_board_quota() from public, anon, authenticated, service_role;
revoke execute on function public.enforce_card_quota() from public, anon, authenticated, service_role;

-- 3. Bounded import ----------------------------------------------------------------------------
-- Same behaviour as before, but an oversized or malformed payload is refused before any work is done.
create or replace function public.import_workspace(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  board_rec record;
  card_rec record;
  id_map jsonb := '{}'::jsonb;
  new_id uuid;
  base integer;
  due date;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_typeof(payload) is distinct from 'object'
     or jsonb_typeof(coalesce(payload->'boards', '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(coalesce(payload->'cards', '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Import data is not in the expected format';
  end if;
  if jsonb_array_length(coalesce(payload->'boards', '[]'::jsonb)) > 100
     or jsonb_array_length(coalesce(payload->'cards', '[]'::jsonb)) > 5000 then
    raise exception 'Import is too large (at most 100 boards and 5000 cards)';
  end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));

  -- An untouched starter board would just sit empty beside the imported ones.
  if (select count(*) from public.boards where user_id = uid) = 1
     and not exists (select 1 from public.cards where user_id = uid) then
    delete from public.boards where user_id = uid and name = 'My Board';
  end if;

  select coalesce(max(position), 0) into base from public.boards where user_id = uid;

  for board_rec in
    select value, ordinality
    from jsonb_array_elements(coalesce(payload->'boards', '[]'::jsonb)) with ordinality
  loop
    insert into public.boards (name, position)
    values (left(btrim(board_rec.value->>'name'), 30), base + board_rec.ordinality)
    returning id into new_id;
    id_map := id_map || jsonb_build_object(board_rec.value->>'id', new_id);
  end loop;

  for card_rec in
    select value, ordinality
    from jsonb_array_elements(coalesce(payload->'cards', '[]'::jsonb)) with ordinality
  loop
    continue when not (id_map ? (card_rec.value->>'board_id'));
    begin
      due := (card_rec.value->>'due_date')::date;
    exception when others then
      due := current_date;
    end;
    insert into public.cards
      (board_id, title, assignee, priority, due_date, status, description, position)
    values (
      (id_map->>(card_rec.value->>'board_id'))::uuid,
      left(btrim(card_rec.value->>'title'), 200),
      left(btrim(card_rec.value->>'assignee'), 100),
      card_rec.value->>'priority',
      due,
      card_rec.value->>'status',
      left(coalesce(card_rec.value->>'description', ''), 10000),
      card_rec.ordinality
    );
  end loop;
end;
$$;

revoke execute on function public.import_workspace(jsonb) from public, anon;
grant execute on function public.import_workspace(jsonb) to authenticated;

-- 4. The rules, in plain words -----------------------------------------------------------------
comment on policy "Users read own boards" on public.boards is
  'A signed-in person can see only the boards they own. Visitors who are not signed in see nothing.';
comment on policy "Users create own boards" on public.boards is
  'A signed-in person can create boards, and only in their own name.';
comment on policy "Users update own boards" on public.boards is
  'A signed-in person can rename or reorder only their own boards, and cannot hand one to someone else.';
comment on policy "Users delete own boards" on public.boards is
  'A signed-in person can delete only their own boards (their cards go with them).';
comment on policy "Users read own cards" on public.cards is
  'A signed-in person can see only the cards they own. Visitors who are not signed in see nothing.';
comment on policy "Users create own cards" on public.cards is
  'A signed-in person can add cards only in their own name and only onto a board they own.';
comment on policy "Users update own cards" on public.cards is
  'A signed-in person can edit or move only their own cards, and only onto a board they own.';
comment on policy "Users delete own cards" on public.cards is
  'A signed-in person can delete only their own cards.';
