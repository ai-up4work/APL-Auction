create extension if not exists "pgcrypto";

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  auction_id text unique not null,
  match_setup jsonb not null,
  match_setup_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists balls (
  id bigserial primary key,
  match_id uuid not null references matches(id) on delete cascade,
  innings_number smallint not null,
  sequence int not null,
  over_number smallint not null,
  ball_number smallint not null,
  striker_name text,
  non_striker_name text,
  bowler_name text,
  runs smallint not null default 0,
  extra_type text,
  is_wicket boolean not null default false,
  dismissal_type text,
  batsman_out text,
  fielder text,
  is_free_hit boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, innings_number, sequence)
);

create table if not exists match_state (
  match_id uuid primary key references matches(id) on delete cascade,
  live_state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists engine_state (
  match_id uuid primary key references matches(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists weather_readings (
  match_id uuid primary key references matches(id) on delete cascade,
  data jsonb not null,
  coords jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists on_air_channels (
  match_id uuid primary key references matches(id) on delete cascade,
  channels jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists tournament_standings (
  id bigserial primary key,
  tournament_id text not null,
  team_short text not null,
  team_name text not null,
  played int not null default 0,
  won int not null default 0,
  lost int not null default 0,
  tied int not null default 0,
  no_result int not null default 0,
  points int not null default 0,
  nrr numeric not null default 0,
  unique (tournament_id, team_short)
);

create index if not exists balls_match_innings_idx on balls (match_id, innings_number, sequence);

-- RLS: enable + open policies for now (tighten once you have real auth).
alter table matches enable row level security;
alter table balls enable row level security;
alter table match_state enable row level security;
alter table engine_state enable row level security;
alter table weather_readings enable row level security;
alter table on_air_channels enable row level security;
alter table tournament_standings enable row level security;

create policy "allow all matches" on matches for all using (true) with check (true);
create policy "allow all balls" on balls for all using (true) with check (true);
create policy "allow all match_state" on match_state for all using (true) with check (true);
create policy "allow all engine_state" on engine_state for all using (true) with check (true);
create policy "allow all weather_readings" on weather_readings for all using (true) with check (true);
create policy "allow all on_air_channels" on on_air_channels for all using (true) with check (true);
create policy "allow all tournament_standings" on tournament_standings for all using (true) with check (true);