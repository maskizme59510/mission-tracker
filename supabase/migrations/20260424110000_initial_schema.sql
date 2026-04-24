-- Mission Tracker - Initial schema
-- Phase 2: tables, constraints, indexes, RLS policies, dashboard view

create extension if not exists pgcrypto;

create type public.profile_role as enum ('admin');
create type public.mission_status as enum ('active', 'paused', 'closed');
create type public.report_type as enum ('kickoff', 'followup');
create type public.report_status as enum (
  'draft',
  'pending_consultant_validation',
  'validated',
  'sent_to_client'
);
create type public.section_type as enum (
  'consultant_feedback',
  'client_feedback',
  'next_objectives',
  'training'
);
create type public.email_type as enum ('consultant_validation', 'client_send');
create type public.email_status as enum ('queued', 'sent', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  role public.profile_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  consultant_first_name text not null,
  consultant_last_name text not null,
  consultant_email text not null,
  client_name text not null,
  client_contact_email text not null,
  start_date date not null,
  follow_up_frequency_days integer not null default 90 check (follow_up_frequency_days > 0),
  status public.mission_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_reports (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  type public.report_type not null,
  report_date date not null,
  last_followup_date date,
  next_followup_date date not null,
  status public.report_status not null default 'draft',
  consultant_validated_at timestamptz,
  sent_to_client_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mission_reports_one_kickoff_per_mission_idx
  on public.mission_reports(mission_id)
  where type = 'kickoff';

create table if not exists public.report_participants (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.mission_reports(id) on delete cascade,
  name text not null,
  role_label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.report_sections_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.mission_reports(id) on delete cascade,
  section_type public.section_type not null,
  content text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.report_validation_tokens (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.mission_reports(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint report_validation_tokens_not_expired_after_create check (expires_at > created_at)
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.mission_reports(id) on delete cascade,
  recipient_email text not null,
  email_type public.email_type not null,
  provider_message_id text,
  status public.email_status not null default 'queued',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists missions_owner_id_idx on public.missions(owner_id);
create index if not exists missions_status_idx on public.missions(status);
create index if not exists mission_reports_mission_id_idx on public.mission_reports(mission_id);
create index if not exists mission_reports_status_idx on public.mission_reports(status);
create index if not exists mission_reports_next_followup_date_idx on public.mission_reports(next_followup_date);
create index if not exists report_participants_report_id_idx on public.report_participants(report_id);
create index if not exists report_sections_items_report_id_idx on public.report_sections_items(report_id);
create index if not exists report_validation_tokens_report_id_idx on public.report_validation_tokens(report_id);
create index if not exists report_validation_tokens_expires_at_idx on public.report_validation_tokens(expires_at);
create index if not exists email_logs_report_id_idx on public.email_logs(report_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists missions_set_updated_at on public.missions;
create trigger missions_set_updated_at
before update on public.missions
for each row execute procedure public.set_updated_at();

drop trigger if exists mission_reports_set_updated_at on public.mission_reports;
create trigger mission_reports_set_updated_at
before update on public.mission_reports
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.mission_reports enable row level security;
alter table public.report_participants enable row level security;
alter table public.report_sections_items enable row level security;
alter table public.report_validation_tokens enable row level security;
alter table public.email_logs enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "missions_owner_full_access"
on public.missions
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "mission_reports_owner_full_access"
on public.mission_reports
for all
using (
  exists (
    select 1
    from public.missions m
    where m.id = mission_reports.mission_id
      and m.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.missions m
    where m.id = mission_reports.mission_id
      and m.owner_id = auth.uid()
  )
);

create policy "report_participants_owner_full_access"
on public.report_participants
for all
using (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_participants.report_id
      and m.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_participants.report_id
      and m.owner_id = auth.uid()
  )
);

create policy "report_sections_items_owner_full_access"
on public.report_sections_items
for all
using (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_sections_items.report_id
      and m.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_sections_items.report_id
      and m.owner_id = auth.uid()
  )
);

create policy "report_validation_tokens_owner_full_access"
on public.report_validation_tokens
for all
using (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_validation_tokens.report_id
      and m.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_validation_tokens.report_id
      and m.owner_id = auth.uid()
  )
);

create policy "email_logs_owner_full_access"
on public.email_logs
for all
using (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = email_logs.report_id
      and m.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = email_logs.report_id
      and m.owner_id = auth.uid()
  )
);

create or replace view public.mission_health_view as
with latest_reports as (
  select distinct on (mr.mission_id)
    mr.id,
    mr.mission_id,
    mr.report_date,
    mr.next_followup_date,
    mr.status,
    mr.updated_at
  from public.mission_reports mr
  order by mr.mission_id, mr.report_date desc, mr.created_at desc
),
pending_validation as (
  select
    mr.mission_id,
    bool_or(
      mr.status = 'pending_consultant_validation'
      and mr.updated_at < now() - interval '5 days'
    ) as has_pending_validation_over_5_days
  from public.mission_reports mr
  group by mr.mission_id
)
select
  m.id as mission_id,
  m.owner_id,
  m.consultant_first_name,
  m.consultant_last_name,
  m.consultant_email,
  m.client_name,
  m.client_contact_email,
  m.start_date,
  m.follow_up_frequency_days,
  m.status as mission_status,
  lr.id as latest_report_id,
  lr.report_date as latest_report_date,
  lr.next_followup_date,
  lr.status as latest_report_status,
  (lr.next_followup_date < current_date) as is_follow_up_overdue,
  (lr.next_followup_date between current_date and current_date + interval '14 days') as is_follow_up_within_14_days,
  coalesce(pv.has_pending_validation_over_5_days, false) as is_pending_validation_over_5_days,
  case
    when lr.next_followup_date < current_date then 'red'
    when coalesce(pv.has_pending_validation_over_5_days, false) then 'yellow'
    else 'green'
  end as health_color
from public.missions m
left join latest_reports lr on lr.mission_id = m.id
left join pending_validation pv on pv.mission_id = m.id;

grant select on public.mission_health_view to authenticated;
