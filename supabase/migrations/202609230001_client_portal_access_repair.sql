-- Client portal access repair (backward compatibility).
--
-- Root cause class:
--   Invited clients hit the owner subscription/plan wall before /team/accept could
--   finish. Accounts may exist with incomplete relationships:
--     - pending client invitations never marked accepted
--     - missing organization_members (role client)
--     - profiles still personal owner instead of client
--     - missing job_client_access for the invited job
--
-- Safety:
--   - Only repairs role='client' invitations / existing client access rows
--   - Never demotes manager/admin/employee/contractor/viewer accounts
--   - Never converts an organization owner_user_id of the inviting org
--   - Never converts owners of orgs that already have team members or jobs
--   - Idempotent; writes a durable report into public.data_repair_log

create table if not exists public.data_repair_log (
  id uuid primary key default gen_random_uuid(),
  repair_key text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists data_repair_log_key_idx
  on public.data_repair_log (repair_key, created_at desc);

alter table public.data_repair_log enable row level security;

-- True when this user owns a real business workspace (not a solo invitee bootstrap).
create or replace function public.client_repair_is_business_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.owner_user_id = p_user_id
      and (
        exists (
          select 1
          from public.organization_members om
          where om.organization_id = o.id
            and om.active = true
            and om.user_id <> p_user_id
        )
        or exists (
          select 1
          from public.jobs j
          where j.organization_id = o.id
        )
        or lower(coalesce(o.plan, 'free')) not in ('free', '')
      )
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = p_user_id
      and om.active = true
      and lower(coalesce(om.role, '')) in ('owner', 'admin', 'manager', 'employee', 'contractor', 'crew_lead', 'staff', 'viewer')
      and exists (
        select 1
        from public.organization_members other
        where other.organization_id = om.organization_id
          and other.active = true
          and other.user_id <> p_user_id
      )
  );
$$;

create or replace function public.repair_client_portal_access_for_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_role text;
  v_profile_org uuid;
  v_can_become_client boolean := false;
  v_has_access boolean := false;
  v_invites_repaired int := 0;
  v_access_upserts int := 0;
  v_membership_upserts int := 0;
  v_profile_updated boolean := false;
  v_target_org uuid := null;
  v_invite record;
  v_owner_user_id uuid;
  v_job_org uuid;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'user_id_required');
  end if;

  -- Authenticated callers may only repair themselves; service_role can repair any user.
  if auth.role() = 'authenticated' and auth.uid() is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'userId', p_user_id);
  end if;

  select
    lower(btrim(coalesce(p.email, u.email, ''))),
    lower(coalesce(p.role, '')),
    p.organization_id
  into v_email, v_role, v_profile_org
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;

  if v_email is null or v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'email_missing', 'userId', p_user_id);
  end if;

  select exists (
    select 1 from public.job_client_access jca where jca.client_user_id = p_user_id
  ) into v_has_access;

  -- Never demote protected staff/contractor roles.
  if v_role in ('admin', 'manager', 'employee', 'contractor', 'crew_lead', 'staff', 'viewer') then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'protected_role',
      'role', v_role,
      'userId', p_user_id
    );
  end if;

  v_can_become_client :=
    v_role = 'client'
    or v_has_access
    or (
      v_role in ('owner', '')
      and not public.client_repair_is_business_owner(p_user_id)
      and exists (
        select 1
        from public.organization_invitations oi
        where lower(btrim(oi.email)) = v_email
          and lower(coalesce(oi.role, '')) = 'client'
          and lower(coalesce(oi.status, '')) in ('pending', 'accepted', 'expired')
      )
    );

  if not v_can_become_client then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'not_eligible',
      'role', v_role,
      'userId', p_user_id
    );
  end if;

  for v_invite in
    select
      oi.id,
      oi.organization_id,
      oi.job_id,
      oi.status,
      oi.created_at
    from public.organization_invitations oi
    where lower(btrim(oi.email)) = v_email
      and lower(coalesce(oi.role, '')) = 'client'
      -- Include expired invites so stuck invitees do not need a re-invite.
      and lower(coalesce(oi.status, '')) in ('pending', 'accepted', 'expired')
      -- Never attach a client into an org they already own.
      and not exists (
        select 1
        from public.organizations o
        where o.id = oi.organization_id
          and o.owner_user_id = p_user_id
      )
    order by
      case when oi.job_id is not null then 0 else 1 end,
      oi.created_at desc
  loop
    v_invites_repaired := v_invites_repaired + 1;
    if v_target_org is null then
      v_target_org := v_invite.organization_id;
    end if;

    insert into public.organization_members (organization_id, user_id, role, active)
    values (v_invite.organization_id, p_user_id, 'client', true)
    on conflict (organization_id, user_id) do update
      set role = 'client',
          active = true;
    v_membership_upserts := v_membership_upserts + 1;

    if lower(coalesce(v_invite.status, '')) in ('pending', 'expired') then
      update public.organization_invitations
      set status = 'accepted',
          accepted_at = coalesce(accepted_at, now())
      where id = v_invite.id
        and lower(coalesce(status, '')) in ('pending', 'expired');
    end if;

    if v_invite.job_id is not null then
      select o.owner_user_id into v_owner_user_id
      from public.organizations o
      where o.id = v_invite.organization_id;

      select j.organization_id into v_job_org
      from public.jobs j
      where j.id = v_invite.job_id;

      if v_owner_user_id is not null then
        insert into public.job_client_access (
          job_id,
          client_user_id,
          owner_user_id,
          organization_id,
          granted_at,
          can_view_photos,
          can_view_notes,
          can_view_reports
        )
        values (
          v_invite.job_id,
          p_user_id,
          v_owner_user_id,
          coalesce(v_invite.organization_id, v_job_org),
          now(),
          true,
          true,
          true
        )
        on conflict (job_id, client_user_id) do update
          set organization_id = coalesce(public.job_client_access.organization_id, excluded.organization_id),
              owner_user_id = coalesce(public.job_client_access.owner_user_id, excluded.owner_user_id),
              granted_at = coalesce(public.job_client_access.granted_at, excluded.granted_at);
        v_access_upserts := v_access_upserts + 1;
      end if;
    end if;
  end loop;

  -- Backfill organization_id on any existing access rows for this client.
  update public.job_client_access jca
  set organization_id = j.organization_id
  from public.jobs j
  where jca.client_user_id = p_user_id
    and jca.job_id = j.id
    and jca.organization_id is null
    and j.organization_id is not null;

  -- Ensure membership for orgs already present on job_client_access.
  insert into public.organization_members (organization_id, user_id, role, active)
  select distinct jca.organization_id, p_user_id, 'client', true
  from public.job_client_access jca
  where jca.client_user_id = p_user_id
    and jca.organization_id is not null
  on conflict (organization_id, user_id) do update
    set role = 'client',
        active = true;

  if v_target_org is null then
    select jca.organization_id
    into v_target_org
    from public.job_client_access jca
    where jca.client_user_id = p_user_id
      and jca.organization_id is not null
    order by jca.granted_at desc nulls last
    limit 1;
  end if;

  if v_target_org is not null and (v_role = 'client' or v_role in ('owner', '') or v_has_access) then
    update public.profiles
    set role = 'client',
        organization_id = coalesce(v_target_org, organization_id)
    where id = p_user_id
      and (
        coalesce(role, '') is distinct from 'client'
        or organization_id is distinct from coalesce(v_target_org, organization_id)
      );
    if found then
      v_profile_updated := true;
      v_role := 'client';
    else
      -- still normalize role when already matching org
      update public.profiles
      set role = 'client'
      where id = p_user_id
        and coalesce(role, '') is distinct from 'client';
      if found then
        v_profile_updated := true;
        v_role := 'client';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'userId', p_user_id,
    'email', v_email,
    'role', v_role,
    'organizationId', v_target_org,
    'invitesRepaired', v_invites_repaired,
    'membershipUpserts', v_membership_upserts,
    'accessUpserts', v_access_upserts,
    'profileUpdated', v_profile_updated
  );
end;
$$;

revoke all on function public.client_repair_is_business_owner(uuid) from public;
revoke all on function public.repair_client_portal_access_for_user(uuid) from public;
grant execute on function public.client_repair_is_business_owner(uuid) to service_role;
grant execute on function public.repair_client_portal_access_for_user(uuid) to service_role;
-- Self-repair for existing sessions (middleware / portal) without requiring service role.
grant execute on function public.repair_client_portal_access_for_user(uuid) to authenticated;

-- One-shot batch for every existing candidate (clients, access holders, invited emails).
create or replace function public.repair_client_portal_access_all()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result jsonb;
  v_repaired int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_details jsonb := '[]'::jsonb;
begin
  for v_user_id in
    select distinct candidate_user_id
    from (
      select p.id as candidate_user_id
      from public.profiles p
      where lower(coalesce(p.role, '')) = 'client'
      union
      select jca.client_user_id
      from public.job_client_access jca
      where jca.client_user_id is not null
      union
      select u.id
      from public.organization_invitations oi
      join auth.users u on lower(btrim(u.email)) = lower(btrim(oi.email))
      where lower(coalesce(oi.role, '')) = 'client'
        and lower(coalesce(oi.status, '')) in ('pending', 'accepted', 'expired')
    ) candidates
  loop
    begin
      v_result := public.repair_client_portal_access_for_user(v_user_id);
      if coalesce((v_result ->> 'skipped')::boolean, false) then
        v_skipped := v_skipped + 1;
      elsif coalesce((v_result ->> 'ok')::boolean, false) then
        v_repaired := v_repaired + 1;
        if coalesce((v_result ->> 'invitesRepaired')::int, 0) > 0
           or coalesce((v_result ->> 'accessUpserts')::int, 0) > 0
           or coalesce((v_result ->> 'profileUpdated')::boolean, false)
        then
          v_details := v_details || jsonb_build_array(v_result);
        end if;
      else
        v_failed := v_failed + 1;
        v_details := v_details || jsonb_build_array(v_result);
      end if;
    exception when others then
      v_failed := v_failed + 1;
      v_details := v_details || jsonb_build_array(
        jsonb_build_object('ok', false, 'userId', v_user_id, 'error', SQLERRM)
      );
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'repaired', v_repaired,
    'skipped', v_skipped,
    'failed', v_failed,
    'details', v_details
  );
end;
$$;

revoke all on function public.repair_client_portal_access_all() from public;
grant execute on function public.repair_client_portal_access_all() to service_role;

do $$
declare
  v_batch jsonb;
begin
  v_batch := public.repair_client_portal_access_all();
  insert into public.data_repair_log (repair_key, detail)
  values ('client_portal_access_repair:batch', v_batch);
end $$;
