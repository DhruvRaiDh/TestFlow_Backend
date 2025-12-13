-- Projects Table
create table public.projects (
  id uuid not null primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Recorded Scripts Table
create table public.recorded_scripts (
  id text not null primary key, -- Keeping text ID to match existing timestamp-based IDs for now, or could use UUID
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  module text,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Execution Reports Table
create table public.execution_reports (
  id text not null primary key,
  project_id uuid references public.projects(id) on delete cascade,
  script_id text references public.recorded_scripts(id) on delete set null,
  script_name text not null,
  module text,
  status text not null check (status in ('pass', 'fail')),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  duration integer not null,
  error text,
  steps_completed integer not null default 0,
  total_steps integer not null default 0
);

-- Enable Row Level Security (RLS)
alter table public.projects enable row level security;
alter table public.recorded_scripts enable row level security;
alter table public.execution_reports enable row level security;

-- Create Policies (Public access for now since we don't have auth yet)
create policy "Public projects access" on public.projects for all using (true);
create policy "Public scripts access" on public.recorded_scripts for all using (true);
create policy "Public reports access" on public.execution_reports for all using (true);
