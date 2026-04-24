create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.mission_reports(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_owner_id_created_at_idx
  on public.admin_notifications(owner_id, created_at desc);

alter table public.admin_notifications enable row level security;

create policy "admin_notifications_owner_full_access"
on public.admin_notifications
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);
