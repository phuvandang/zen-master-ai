-- Daily logs: short summary of each session
create table daily_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  content text not null,
  log_date date not null default current_date,
  created_at timestamptz default now()
);

-- Reflections: 5-part internal reflection per session
create table reflections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- Meta-reflections: compacted periodic summaries
create table meta_reflections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  covers_from date not null,
  covers_to date not null,
  created_at timestamptz default now()
);

-- RLS
alter table daily_logs enable row level security;
alter table reflections enable row level security;
alter table meta_reflections enable row level security;

create policy "users manage own daily_logs"
  on daily_logs for all using (auth.uid() = user_id);

create policy "users manage own reflections"
  on reflections for all using (auth.uid() = user_id);

create policy "users manage own meta_reflections"
  on meta_reflections for all using (auth.uid() = user_id);
