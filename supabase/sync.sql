-- ============================================================
-- LinguaLearn — WatermelonDB <-> Supabase sync (Postgres RPC)
-- Run this whole file once in the Supabase SQL Editor.
-- Synced tables: decks, cards, study_sessions (per-user, RLS-scoped).
-- user_settings / chat_messages are intentionally NOT synced (per-device).
-- ============================================================

-- ---------- Tables (mirror the local WatermelonDB schema) ----------
create table if not exists public.decks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text,
  description text,
  cefr_level text,
  category text,
  card_count integer,
  is_active boolean,
  target_language text,
  created_at bigint,
  updated_at bigint,
  _deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deck_id text,
  front text,
  back text,
  example_sentence text,
  pronunciation_url text,
  cefr_level text,
  category text,
  target_language text,
  next_review bigint,
  "interval" double precision,
  ease_factor double precision,
  repetitions integer,
  status text,
  created_at bigint,
  updated_at bigint,
  _deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deck_id text,
  cards_studied integer,
  cards_correct integer,
  duration_seconds integer,
  session_type text,
  completed_at bigint,
  created_at bigint,
  _deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

-- Pull-cursor indexes
create index if not exists idx_decks_user_updated          on public.decks (user_id, server_updated_at);
create index if not exists idx_cards_user_updated          on public.cards (user_id, server_updated_at);
create index if not exists idx_study_sessions_user_updated on public.study_sessions (user_id, server_updated_at);

-- ---------- server_updated_at trigger ----------
create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_decks_touch on public.decks;
create trigger trg_decks_touch before insert or update on public.decks
  for each row execute function public.touch_server_updated_at();

drop trigger if exists trg_cards_touch on public.cards;
create trigger trg_cards_touch before insert or update on public.cards
  for each row execute function public.touch_server_updated_at();

drop trigger if exists trg_study_sessions_touch on public.study_sessions;
create trigger trg_study_sessions_touch before insert or update on public.study_sessions
  for each row execute function public.touch_server_updated_at();

-- ---------- Row Level Security: each user only sees their own rows ----------
alter table public.decks           enable row level security;
alter table public.cards           enable row level security;
alter table public.study_sessions  enable row level security;

drop policy if exists "own decks" on public.decks;
create policy "own decks" on public.decks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cards" on public.cards;
create policy "own cards" on public.cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own study_sessions" on public.study_sessions;
create policy "own study_sessions" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- PULL  — returns { changes: { table: {created,updated,deleted} }, timestamp }
-- ============================================================

-- Generic per-table change extractor. Strips server-only columns so the payload
-- matches the local WatermelonDB schema exactly.
create or replace function public._changes_for(tbl text, last_pulled_at bigint)
returns jsonb
language plpgsql
security invoker
as $$
declare
  cursor_ts timestamptz := to_timestamp(coalesce(last_pulled_at, 0) / 1000.0);
  created jsonb;
  updated jsonb;
  deleted jsonb;
begin
  execute format($q$
    select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - '_deleted' - 'server_updated_at'), '[]'::jsonb)
    from public.%I t
    where t.user_id = auth.uid() and t._deleted = false
      and t.server_updated_at > $1 and t.created_at > $2
  $q$, tbl) into created using cursor_ts, last_pulled_at;

  execute format($q$
    select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - '_deleted' - 'server_updated_at'), '[]'::jsonb)
    from public.%I t
    where t.user_id = auth.uid() and t._deleted = false
      and t.server_updated_at > $1 and t.created_at <= $2
  $q$, tbl) into updated using cursor_ts, last_pulled_at;

  execute format($q$
    select coalesce(jsonb_agg(t.id), '[]'::jsonb)
    from public.%I t
    where t.user_id = auth.uid() and t._deleted = true
      and t.server_updated_at > $1
  $q$, tbl) into deleted using cursor_ts;

  return jsonb_build_object('created', created, 'updated', updated, 'deleted', deleted);
end;
$$;

create or replace function public.pull(last_pulled_at bigint)
returns jsonb
language plpgsql
security invoker
as $$
begin
  return jsonb_build_object(
    'changes', jsonb_build_object(
      'decks',          public._changes_for('decks', last_pulled_at),
      'cards',          public._changes_for('cards', last_pulled_at),
      'study_sessions', public._changes_for('study_sessions', last_pulled_at)
    ),
    'timestamp', (extract(epoch from now()) * 1000)::bigint
  );
end;
$$;

-- ============================================================
-- PUSH — applies the client's local changes (upsert + soft-delete)
-- Conflict strategy: last-write-wins (client upsert overwrites).
-- ============================================================
create or replace function public.push(changes jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  -- ---- decks ----
  insert into public.decks as t
    (id, user_id, name, description, cefr_level, category, card_count, is_active, target_language, created_at, updated_at, _deleted)
  select x.id, auth.uid(), x.name, x.description, x.cefr_level, x.category, x.card_count, x.is_active, x.target_language, x.created_at, x.updated_at, false
  from jsonb_populate_recordset(null::public.decks,
        coalesce(changes->'decks'->'created', '[]'::jsonb) || coalesce(changes->'decks'->'updated', '[]'::jsonb)) x
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, cefr_level = excluded.cefr_level,
    category = excluded.category, card_count = excluded.card_count, is_active = excluded.is_active,
    target_language = excluded.target_language, created_at = excluded.created_at, updated_at = excluded.updated_at,
    _deleted = false
  where t.user_id = auth.uid();

  update public.decks set _deleted = true
  where user_id = auth.uid()
    and id in (select jsonb_array_elements_text(coalesce(changes->'decks'->'deleted', '[]'::jsonb)));

  -- ---- cards ----
  insert into public.cards as t
    (id, user_id, deck_id, front, back, example_sentence, pronunciation_url, cefr_level, category, target_language,
     next_review, "interval", ease_factor, repetitions, status, created_at, updated_at, _deleted)
  select x.id, auth.uid(), x.deck_id, x.front, x.back, x.example_sentence, x.pronunciation_url, x.cefr_level, x.category, x.target_language,
     x.next_review, x."interval", x.ease_factor, x.repetitions, x.status, x.created_at, x.updated_at, false
  from jsonb_populate_recordset(null::public.cards,
        coalesce(changes->'cards'->'created', '[]'::jsonb) || coalesce(changes->'cards'->'updated', '[]'::jsonb)) x
  on conflict (id) do update set
    deck_id = excluded.deck_id, front = excluded.front, back = excluded.back, example_sentence = excluded.example_sentence,
    pronunciation_url = excluded.pronunciation_url, cefr_level = excluded.cefr_level, category = excluded.category,
    target_language = excluded.target_language, next_review = excluded.next_review, "interval" = excluded."interval",
    ease_factor = excluded.ease_factor, repetitions = excluded.repetitions, status = excluded.status,
    created_at = excluded.created_at, updated_at = excluded.updated_at, _deleted = false
  where t.user_id = auth.uid();

  update public.cards set _deleted = true
  where user_id = auth.uid()
    and id in (select jsonb_array_elements_text(coalesce(changes->'cards'->'deleted', '[]'::jsonb)));

  -- ---- study_sessions ----
  insert into public.study_sessions as t
    (id, user_id, deck_id, cards_studied, cards_correct, duration_seconds, session_type, completed_at, created_at, _deleted)
  select x.id, auth.uid(), x.deck_id, x.cards_studied, x.cards_correct, x.duration_seconds, x.session_type, x.completed_at, x.created_at, false
  from jsonb_populate_recordset(null::public.study_sessions,
        coalesce(changes->'study_sessions'->'created', '[]'::jsonb) || coalesce(changes->'study_sessions'->'updated', '[]'::jsonb)) x
  on conflict (id) do update set
    deck_id = excluded.deck_id, cards_studied = excluded.cards_studied, cards_correct = excluded.cards_correct,
    duration_seconds = excluded.duration_seconds, session_type = excluded.session_type, completed_at = excluded.completed_at,
    created_at = excluded.created_at, _deleted = false
  where t.user_id = auth.uid();

  update public.study_sessions set _deleted = true
  where user_id = auth.uid()
    and id in (select jsonb_array_elements_text(coalesce(changes->'study_sessions'->'deleted', '[]'::jsonb)));
end;
$$;

-- ---------- Grants ----------
-- Table-level privileges for the authenticated role (RLS still restricts rows).
-- Required because tables created via raw SQL are NOT auto-granted by Supabase.
grant select, insert, update, delete on public.decks          to authenticated;
grant select, insert, update, delete on public.cards          to authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;

grant execute on function public._changes_for(text, bigint) to authenticated;
grant execute on function public.pull(bigint)               to authenticated;
grant execute on function public.push(jsonb)                to authenticated;
