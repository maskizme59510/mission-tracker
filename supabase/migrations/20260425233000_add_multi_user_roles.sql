alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type text using (
    case
      when role::text = 'admin' then 'directeur'
      else role::text
    end
  );

alter table public.profiles
  alter column role set default 'commercial';

alter table public.profiles
  add column if not exists manager_id uuid references public.profiles(id) on delete set null,
  add column if not exists user_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('commercial', 'responsable', 'directeur'));
  end if;
end $$;

create index if not exists profiles_manager_id_idx on public.profiles(manager_id);
create unique index if not exists profiles_user_code_unique_idx on public.profiles(user_code) where user_code is not null;

update public.profiles
set role = 'directeur',
    user_code = 'FBA',
    manager_id = null
where upper(first_name) = 'FABRICE' and upper(last_name) = 'BAILLY';

update public.profiles
set role = 'responsable',
    user_code = 'MIS',
    manager_id = null
where upper(first_name) = 'MAXIME' and upper(last_name) = 'ISAERT';

update public.profiles
set role = 'responsable',
    user_code = 'EGE',
    manager_id = null
where upper(first_name) = 'ERIC' and upper(last_name) = 'GERBERON';

update public.profiles
set role = 'responsable',
    user_code = 'EAL',
    manager_id = null
where upper(first_name) = 'EMMANUEL' and upper(last_name) = 'ALRIC';

update public.profiles
set role = 'commercial',
    user_code = 'JCO',
    manager_id = (
      select id
      from public.profiles
      where upper(first_name) = 'MAXIME' and upper(last_name) = 'ISAERT'
      limit 1
    )
where upper(first_name) = 'JEAN' and upper(last_name) = 'COCHETEUX';

update public.profiles
set role = 'commercial',
    user_code = 'RLA',
    manager_id = (
      select id
      from public.profiles
      where upper(first_name) = 'MAXIME' and upper(last_name) = 'ISAERT'
      limit 1
    )
where upper(first_name) = 'RENAUD' and upper(last_name) = 'LAGACHE';
