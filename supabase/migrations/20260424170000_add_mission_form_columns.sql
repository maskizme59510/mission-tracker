-- Add missing columns used by mission creation form
alter table public.missions
add column if not exists consultant_type text;

alter table public.missions
add column if not exists client_operational_contact text;

alter table public.missions
add column if not exists last_followup_date date;

alter table public.missions
add column if not exists next_followup_date date;

-- Backfill consultant_type for existing rows before enforcing NOT NULL
update public.missions
set consultant_type = coalesce(consultant_type, 'Consultant Externe');

alter table public.missions
alter column consultant_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'missions_consultant_type_check'
  ) then
    alter table public.missions
    add constraint missions_consultant_type_check
    check (consultant_type in ('Consultant Interne', 'Consultant Externe'));
  end if;
end $$;
