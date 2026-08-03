-- EVA Tracker schema
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

create extension if not exists pgcrypto;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_color text not null default '#0a0f2c',
  accent text not null default '#e5231b',
  platforms text[] not null default '{}',
  trends text not null default '',
  content_ideas text not null default '',
  comparison_report text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  position int not null,
  created_at timestamptz not null default now()
);
create index if not exists weeks_client_id_idx on weeks(client_id);

create table if not exists metrics (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks(id) on delete cascade,
  platform text not null,
  metric_key text not null,
  value numeric,
  unique (week_id, platform, metric_key)
);
create index if not exists metrics_week_id_idx on metrics(week_id);

create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform text not null,
  log_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists daily_logs_client_id_idx on daily_logs(client_id);

create table if not exists daily_log_metrics (
  daily_log_id uuid not null references daily_logs(id) on delete cascade,
  metric_key text not null,
  value numeric,
  primary key (daily_log_id, metric_key)
);

create table if not exists inspiration_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  link text not null,
  likes numeric,
  comments numeric,
  reposts numeric,
  caption text,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists inspiration_posts_client_id_idx on inspiration_posts(client_id);

-- Row Level Security
-- The app has no login step and talks to Supabase directly from the browser
-- with the publishable key, so anyone holding that key can read/write everything
-- below. That's acceptable for a private single-user tool behind a private URL;
-- add real auth and per-user policies before this is multi-tenant or public-facing.
alter table clients enable row level security;
alter table weeks enable row level security;
alter table metrics enable row level security;
alter table daily_logs enable row level security;
alter table daily_log_metrics enable row level security;
alter table inspiration_posts enable row level security;

create policy "public access" on clients for all using (true) with check (true);
create policy "public access" on weeks for all using (true) with check (true);
create policy "public access" on metrics for all using (true) with check (true);
create policy "public access" on daily_logs for all using (true) with check (true);
create policy "public access" on daily_log_metrics for all using (true) with check (true);
create policy "public access" on inspiration_posts for all using (true) with check (true);
