create or replace function public.can_access_mission_owner(_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = _owner_id
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'directeur'
    )
    or exists (
      select 1
      from public.profiles manager
      join public.profiles commercial on commercial.manager_id = manager.id
      where manager.id = auth.uid()
        and manager.role = 'responsable'
        and commercial.role = 'commercial'
        and commercial.id = _owner_id
    );
$$;

drop policy if exists "missions_owner_full_access" on public.missions;
create policy "missions_role_based_access"
on public.missions
for all
using (public.can_access_mission_owner(owner_id))
with check (public.can_access_mission_owner(owner_id));

drop policy if exists "mission_reports_owner_full_access" on public.mission_reports;
create policy "mission_reports_role_based_access"
on public.mission_reports
for all
using (
  exists (
    select 1
    from public.missions m
    where m.id = mission_reports.mission_id
      and public.can_access_mission_owner(m.owner_id)
  )
)
with check (
  exists (
    select 1
    from public.missions m
    where m.id = mission_reports.mission_id
      and public.can_access_mission_owner(m.owner_id)
  )
);

drop policy if exists "report_participants_owner_full_access" on public.report_participants;
create policy "report_participants_role_based_access"
on public.report_participants
for all
using (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_participants.report_id
      and public.can_access_mission_owner(m.owner_id)
  )
)
with check (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_participants.report_id
      and public.can_access_mission_owner(m.owner_id)
  )
);

drop policy if exists "report_sections_items_owner_full_access" on public.report_sections_items;
create policy "report_sections_items_role_based_access"
on public.report_sections_items
for all
using (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_sections_items.report_id
      and public.can_access_mission_owner(m.owner_id)
  )
)
with check (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_sections_items.report_id
      and public.can_access_mission_owner(m.owner_id)
  )
);

drop policy if exists "report_validation_tokens_owner_full_access" on public.report_validation_tokens;
create policy "report_validation_tokens_role_based_access"
on public.report_validation_tokens
for all
using (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_validation_tokens.report_id
      and public.can_access_mission_owner(m.owner_id)
  )
)
with check (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = report_validation_tokens.report_id
      and public.can_access_mission_owner(m.owner_id)
  )
);

drop policy if exists "email_logs_owner_full_access" on public.email_logs;
create policy "email_logs_role_based_access"
on public.email_logs
for all
using (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = email_logs.report_id
      and public.can_access_mission_owner(m.owner_id)
  )
)
with check (
  exists (
    select 1
    from public.mission_reports mr
    join public.missions m on m.id = mr.mission_id
    where mr.id = email_logs.report_id
      and public.can_access_mission_owner(m.owner_id)
  )
);
