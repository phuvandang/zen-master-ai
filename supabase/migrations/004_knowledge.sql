create table knowledge_sources (
  id uuid primary key default uuid_generate_v4(),
  added_by uuid references auth.users(id) on delete set null,
  source_key text not null unique,
  title text not null,
  teacher text not null default '',
  source_url text not null,
  topics text[] not null default '{}',
  content text not null default '',
  created_at timestamptz default now()
);

alter table knowledge_sources enable row level security;

create policy "authenticated manage knowledge_sources"
  on knowledge_sources for all to authenticated using (true) with check (true);
