-- Ensure legacy company rows exist for workspaces that require customers.company_id.

create or replace function public.ensure_user_company(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_owner_id uuid;
  v_label text;
begin
  if p_user_id is null then
    return null;
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'companies'
  ) then
    return null;
  end if;

  select coalesce(nullif(trim(business_name), ''), 'My Business')
  into v_label
  from public.profiles
  where id = p_user_id;

  v_label := coalesce(v_label, 'My Business');
  v_owner_id := p_user_id;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'company_id'
  ) then
    select company_id into v_company_id from public.profiles where id = p_user_id;
    if v_company_id is not null then
      return v_company_id;
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'companies' and column_name = 'owner_id'
  ) then
    select c.id into v_company_id
    from public.companies c
    where c.owner_id = v_owner_id
    order by c.id
    limit 1;
  end if;

  if v_company_id is null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'companies' and column_name = 'user_id'
  ) then
    select c.id into v_company_id
    from public.companies c
    where c.user_id = p_user_id
    order by c.id
    limit 1;
  end if;

  if v_company_id is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'company_id'
    ) then
      update public.profiles set company_id = v_company_id where id = p_user_id and company_id is null;
    end if;
    return v_company_id;
  end if;

  begin
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'companies' and column_name = 'owner_id'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'companies' and column_name = 'company_name'
    ) then
      insert into public.companies (owner_id, company_name)
      values (v_owner_id, v_label)
      returning id into v_company_id;
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'companies' and column_name = 'user_id'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'companies' and column_name = 'name'
    ) then
      insert into public.companies (user_id, name)
      values (p_user_id, v_label)
      returning id into v_company_id;
    end if;
  exception when others then
    return null;
  end;

  if v_company_id is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'company_id'
  ) then
    update public.profiles set company_id = v_company_id where id = p_user_id and company_id is null;
  end if;

  return v_company_id;
end;
$$;

grant execute on function public.ensure_user_company(uuid) to service_role;
