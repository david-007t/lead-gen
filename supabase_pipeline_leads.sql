create table if not exists public.pipeline_leads (
  id uuid primary key default gen_random_uuid(),
  unique_key text not null unique,
  source_mode text not null default 'leadlist',
  name text,
  company text,
  email text,
  phone text,
  project_type text,
  budget text,
  location text,
  zip_code text,
  timeline text,
  source text,
  description text,
  follow_up text not null default 'new',
  qualified boolean not null default true,
  score integer not null default 1,
  total integer not null default 1,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pipeline_leads_source_mode_idx on public.pipeline_leads (source_mode);
create index if not exists pipeline_leads_created_at_idx on public.pipeline_leads (created_at desc);

create or replace function public.set_pipeline_leads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_pipeline_leads_updated_at on public.pipeline_leads;
create trigger set_pipeline_leads_updated_at
before update on public.pipeline_leads
for each row
execute function public.set_pipeline_leads_updated_at();

alter table public.pipeline_leads enable row level security;

drop policy if exists "pipeline_leads_select_anon" on public.pipeline_leads;
create policy "pipeline_leads_select_anon"
on public.pipeline_leads for select
to anon
using (true);

drop policy if exists "pipeline_leads_insert_anon" on public.pipeline_leads;
create policy "pipeline_leads_insert_anon"
on public.pipeline_leads for insert
to anon
with check (true);

drop policy if exists "pipeline_leads_update_anon" on public.pipeline_leads;
create policy "pipeline_leads_update_anon"
on public.pipeline_leads for update
to anon
using (true)
with check (true);

drop policy if exists "pipeline_leads_delete_anon" on public.pipeline_leads;
create policy "pipeline_leads_delete_anon"
on public.pipeline_leads for delete
to anon
using (true);
