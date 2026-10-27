-- K-Nexus platform hardening: roles, audit trail, engagement persistence,
-- model cost telemetry, and the persistent knowledge graph with embeddings.
-- Apply in the Supabase SQL editor (or `supabase db push`). Idempotent.

create extension if not exists vector;

-- ── Roles ──────────────────────────────────────────────────────────────────
-- The app reads the role from auth.users.raw_app_meta_data->>'role'. This
-- table is the admin-managed source; the trigger copies it into app_metadata
-- so it travels in the user's session token.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('operator', 'manager', 'partner', 'admin')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.user_roles enable row level security;

create or replace function public.nexus_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'operator')
$$;

drop policy if exists "users read own role" on public.user_roles;
create policy "users read own role" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.nexus_role() = 'admin');
drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles
  for all to authenticated using (public.nexus_role() = 'admin') with check (public.nexus_role() = 'admin');

create or replace function public.sync_role_to_app_metadata() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
   where id = new.user_id;
  return new;
end $$;
drop trigger if exists user_roles_sync on public.user_roles;
create trigger user_roles_sync after insert or update on public.user_roles
  for each row execute function public.sync_role_to_app_metadata();

-- ── Audit trail ────────────────────────────────────────────────────────────
-- Append-only: every user action and every agent output.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid references auth.users(id),
  user_email text,
  role text,
  kind text not null check (kind in ('action', 'agent_output', 'export', 'access')),
  action text not null,
  facility_id text,
  subject text,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at on public.audit_log (at desc);
create index if not exists audit_log_facility on public.audit_log (facility_id, at desc);
alter table public.audit_log enable row level security;
drop policy if exists "authenticated append audit" on public.audit_log;
create policy "authenticated append audit" on public.audit_log
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "partners read audit" on public.audit_log;
create policy "partners read audit" on public.audit_log
  for select to authenticated using (public.nexus_role() in ('partner', 'admin'));
-- No update or delete policies: the log cannot be edited through the API.

-- ── Engagement persistence ────────────────────────────────────────────────
create table if not exists public.user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_state enable row level security;
drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Model cost telemetry ───────────────────────────────────────────────────
create table if not exists public.model_usage (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid references auth.users(id),
  engagement text not null default 'unassigned',   -- facility id or engagement code
  feature text not null,                           -- brief, narrator, copilot, query
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0
);
create index if not exists model_usage_engagement on public.model_usage (engagement, at desc);
alter table public.model_usage enable row level security;
drop policy if exists "authenticated append usage" on public.model_usage;
create policy "authenticated append usage" on public.model_usage
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "partners read usage" on public.model_usage;
create policy "partners read usage" on public.model_usage
  for select to authenticated using (public.nexus_role() in ('partner', 'admin'));

-- ── Knowledge graph: persistent wiki pages with embeddings ─────────────────
create table if not exists public.wiki_pages (
  path text primary key,                 -- e.g. 'patterns/power-as-moat'
  type text not null,                    -- concept | pattern | market | client | facility | incident
  title text not null,
  concept text,                          -- canonical ontology id
  content text not null,
  links text[] not null default '{}',
  embedding vector(512),
  updated_at timestamptz not null default now()
);
create index if not exists wiki_pages_type on public.wiki_pages (type);
create index if not exists wiki_pages_embedding on public.wiki_pages using ivfflat (embedding vector_cosine_ops) with (lists = 50);
alter table public.wiki_pages enable row level security;
drop policy if exists "authenticated read wiki" on public.wiki_pages;
create policy "authenticated read wiki" on public.wiki_pages for select to authenticated using (true);
drop policy if exists "authenticated write wiki" on public.wiki_pages;
create policy "authenticated write wiki" on public.wiki_pages for insert to authenticated with check (true);
drop policy if exists "authenticated update wiki" on public.wiki_pages;
create policy "authenticated update wiki" on public.wiki_pages for update to authenticated using (true);

create or replace function public.match_wiki_pages(query_embedding vector(512), match_count int default 5, exclude_types text[] default '{}')
returns table (path text, type text, title text, content text, similarity float)
language sql stable as $$
  select w.path, w.type, w.title, w.content, 1 - (w.embedding <=> query_embedding) as similarity
    from public.wiki_pages w
   where w.embedding is not null and not (w.type = any(exclude_types))
   order by w.embedding <=> query_embedding
   limit match_count
$$;

-- ── Monitoring ────────────────────────────────────────────────────────────
-- Server errors (instrumentation.js), client errors and web vitals.
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  type text not null check (type in ('server_error', 'client_error', 'web_vital')),
  name text,
  value numeric,
  path text,
  message text,
  digest text
);
create index if not exists app_events_at on public.app_events (at desc);
alter table public.app_events enable row level security;
drop policy if exists "anyone append events" on public.app_events;
create policy "anyone append events" on public.app_events for insert to anon, authenticated with check (true);
drop policy if exists "partners read events" on public.app_events;
create policy "partners read events" on public.app_events for select to authenticated using (public.nexus_role() in ('partner', 'admin'));
