-- Flowboard schema: private boards and cards, one owner per row (row-level security on auth.uid()).

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_user_id_idx on public.boards (user_id);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  assignee text not null check (char_length(btrim(assignee)) between 1 and 100),
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  due_date date not null,
  status text not null default 'backlog'
    check (status in ('backlog', 'in-progress', 'in-review', 'done')),
  description text not null default '' check (char_length(description) <= 10000),
  -- Order within a board column; the app inserts between neighbours using the midpoint.
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cards_board_id_idx on public.cards (board_id);
create index cards_user_id_idx on public.cards (user_id);

-- Keep updated_at fresh.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger boards_set_updated_at before update on public.boards
  for each row execute function public.set_updated_at();
create trigger cards_set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

-- Row-level security: signed-in users can only touch their own rows.
alter table public.boards enable row level security;
alter table public.cards enable row level security;

create policy "Users read own boards" on public.boards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own boards" on public.boards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own boards" on public.boards
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own boards" on public.boards
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Cards must also sit on a board the user owns (stops moving a card onto someone else's board).
create policy "Users read own cards" on public.cards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own cards" on public.cards
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.boards b
      where b.id = board_id and b.user_id = (select auth.uid())
    )
  );
create policy "Users update own cards" on public.cards
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.boards b
      where b.id = board_id and b.user_id = (select auth.uid())
    )
  );
create policy "Users delete own cards" on public.cards
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.boards, public.cards from anon;

-- Creates the starter board for a user who has none. Safe to call repeatedly or concurrently.
create function public.ensure_default_board()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if not exists (select 1 from public.boards where user_id = uid) then
    insert into public.boards (name, position) values ('My Board', 1);
  end if;
end;
$$;

-- One-time import of boards and cards from the browser's localStorage, all in one transaction.
-- payload: {"boards":[{"id","name"}], "cards":[{"board_id","title","assignee","priority",
--           "due_date","status","description"}]}; board_id refers to the payload's own board ids.
create function public.import_workspace(payload jsonb)
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

revoke execute on function public.set_updated_at() from public, anon;
revoke execute on function public.ensure_default_board() from public, anon;
revoke execute on function public.import_workspace(jsonb) from public, anon;
grant execute on function public.ensure_default_board() to authenticated;
grant execute on function public.import_workspace(jsonb) to authenticated;
