-- ============================================================
-- Aevin — database schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- Built for one person today, but every table is keyed by user_id with
-- row-level security, so it stays private and can grow later.
-- ============================================================

create extension if not exists vector;

-- ---------- profiles ----------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text     not null default 'Via',
  timezone              text     not null default 'Asia/Manila',
  proactive_enabled     boolean  not null default true,
  quiet_start           smallint not null default 23 check (quiet_start between 0 and 23),
  quiet_end             smallint not null default 7  check (quiet_end   between 0 and 23),
  max_proactive_per_day smallint not null default 2  check (max_proactive_per_day between 0 and 10),
  created_at            timestamptz not null default now()
);

-- ---------- messages ----------
create table public.messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  source     text not null default 'chat' check (source in ('chat', 'proactive')),
  created_at timestamptz not null default now()
);
create index messages_user_created_idx on public.messages (user_id, created_at desc);

-- ---------- memories (what Aevin knows) ----------
create table public.memories (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('fact', 'episode', 'preference')),
  content    text not null,
  importance smallint not null default 3 check (importance between 1 and 5),
  embedding  vector(768),
  created_at timestamptz not null default now()
);
create index memories_user_kind_idx on public.memories (user_id, kind);
create index memories_embedding_idx on public.memories using hnsw (embedding vector_cosine_ops);

-- ---------- threads (things worth following up on) ----------
create table public.threads (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  description  text not null,
  due_at       timestamptz,             -- null = "check in sometime soon"
  status       text not null default 'open' check (status in ('open', 'done', 'dropped')),
  created_at   timestamptz not null default now(),
  followed_up_at timestamptz
);
create index threads_open_idx on public.threads (user_id, status, due_at);

-- ---------- companion_state (Aevin's running sense of the relationship) ----------
create table public.companion_state (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  summary         text     not null default '',
  tone            text     not null default 'curious and gentle',
  familiarity     smallint not null default 10 check (familiarity between 0 and 100),
  last_contact_at timestamptz,          -- last time the *user* wrote
  last_proactive_at timestamptz,        -- last time Aevin reached out first
  proactive_day   date,                 -- local date the counter below belongs to
  proactive_today smallint not null default 0,
  updated_at      timestamptz not null default now()
);

-- ---------- push_subscriptions (Web Push endpoints, one per device) ----------
create table public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- ---------- new account => profile + state rows ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.companion_state (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- row-level security ----------
alter table public.profiles           enable row level security;
alter table public.messages           enable row level security;
alter table public.memories           enable row level security;
alter table public.threads            enable row level security;
alter table public.companion_state    enable row level security;
alter table public.push_subscriptions enable row level security;

-- You can read and edit your own profile.
create policy "profile: read own"   on public.profiles for select using (id = (select auth.uid()));
create policy "profile: update own" on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- You can read and delete your own chat history. (Messages are written by the Edge Functions.)
create policy "messages: read own"   on public.messages for select using (user_id = (select auth.uid()));
create policy "messages: delete own" on public.messages for delete using (user_id = (select auth.uid()));

-- You can see and delete anything Aevin remembers about you. (Memories are written by the Edge Functions.)
create policy "memories: read own"   on public.memories for select using (user_id = (select auth.uid()));
create policy "memories: delete own" on public.memories for delete using (user_id = (select auth.uid()));

create policy "threads: read own"   on public.threads for select using (user_id = (select auth.uid()));
create policy "threads: update own" on public.threads for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "threads: delete own" on public.threads for delete using (user_id = (select auth.uid()));

create policy "state: read own" on public.companion_state for select using (user_id = (select auth.uid()));

create policy "push: manage own" on public.push_subscriptions for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- live updates: new messages (including ones Aevin starts) appear instantly ----------
alter publication supabase_realtime add table public.messages;

-- ---------- vector search for relevant memories ----------
-- Only the Edge Functions (service role) may call this; it takes a user id as an argument.
create function public.match_memories(
  query_embedding vector(768),
  match_user      uuid,
  match_count     int default 6
)
returns table (
  id         bigint,
  kind       text,
  content    text,
  importance smallint,
  created_at timestamptz,
  similarity float
)
language sql stable as $$
  select m.id, m.kind, m.content, m.importance, m.created_at,
         1 - (m.embedding <=> query_embedding) as similarity
  from public.memories m
  where m.user_id = match_user and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_memories(vector, uuid, int) from public, anon, authenticated;
grant  execute on function public.match_memories(vector, uuid, int) to service_role;
