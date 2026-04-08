-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Soul config (shared, admin-managed)
create table soul_config (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  content text not null default '',
  updated_at timestamptz default now()
);

-- User profiles (extends Supabase auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  address_style text not null default 'bạn',
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- User progress
create table user_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references profiles(id) on delete cascade,
  level text not null default 'Beginner',
  mastered_topics text default '',
  current_topics text default '',
  patterns text default '',
  teaching_notes text default '',
  updated_at timestamptz default now()
);

-- User long-term memory
create table user_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references profiles(id) on delete cascade,
  content text default '',
  updated_at timestamptz default now()
);

-- Chat sessions
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  session_number int not null default 1
);

-- Messages
create table messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Auto-create profile + progress + memory rows when user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  insert into user_progress (user_id) values (new.id);
  insert into user_memory (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table soul_config enable row level security;
alter table profiles enable row level security;
alter table user_progress enable row level security;
alter table user_memory enable row level security;
alter table sessions enable row level security;
alter table messages enable row level security;

create policy "authenticated read soul_config"
  on soul_config for select to authenticated using (true);

create policy "users view own profile"
  on profiles for select using (auth.uid() = id);
create policy "users update own profile"
  on profiles for update using (auth.uid() = id);

create policy "users manage own progress"
  on user_progress for all using (auth.uid() = user_id);

create policy "users manage own memory"
  on user_memory for all using (auth.uid() = user_id);

create policy "users manage own sessions"
  on sessions for all using (auth.uid() = user_id);

create policy "users manage own messages"
  on messages for all using (
    exists (
      select 1 from sessions s
      where s.id = messages.session_id
      and s.user_id = auth.uid()
    )
  );
