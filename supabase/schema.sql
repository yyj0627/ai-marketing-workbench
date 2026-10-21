-- AI 营销方案工作台：Supabase 业务数据表
-- Run this whole file in Supabase Dashboard > SQL Editor.
-- Safe to re-run for the current schema. Do not put service_role keys in the app.

create extension if not exists pgcrypto;

-- Keep authorization helpers out of Supabase's exposed API schemas.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Supports projects created with the earlier auth-only SQL script.
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email <> '';

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type text not null check (type in ('新品上市', '活动推广', '品牌传播', '渠道增长', '线下活动')),
  product_description text not null default '',
  target_audience text not null default '',
  goals text[] not null default '{}',
  selling_points text[] not null default '{}',
  timeline text,
  budget_range text check (budget_range in ('低预算', '中预算', '高预算', '待定')),
  channels text[] not null default '{}',
  tone text check (tone in ('专业', '年轻', '增长导向', '温暖', '高端')),
  status text not null default '草稿' check (status in ('草稿', '生成中', '已生成', '生成失败', '已导出', '已归档')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null check (char_length(trim(title)) > 0),
  generation_summary text,
  status text not null default '草稿' check (status in ('草稿', '生成中', '已生成', '生成失败', '已归档')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create table if not exists public.plan_modules (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_key text not null check (char_length(trim(module_key)) > 0),
  title text not null check (char_length(trim(title)) > 0),
  content text not null default '',
  sort_order integer not null check (sort_order > 0),
  status text not null default '待生成' check (status in ('待生成', '生成中', '已完成', '生成失败')),
  updated_at timestamptz not null default now(),
  unique (plan_id, module_key),
  unique (plan_id, sort_order)
);

create table if not exists public.plan_module_versions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.plan_modules(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null default '',
  change_note text,
  source text not null default '手动编辑' check (source in ('AI 生成', 'AI 修改', '手动编辑', '版本恢复')),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  module_id uuid references public.plan_modules(id) on delete set null,
  action text not null check (action in ('生成完整方案', '生成模块', '重新生成模块', 'AI 修改模块')),
  instruction text,
  status text not null default '排队中' check (status in ('排队中', '生成中', '成功', '失败')),
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  error_message text,
  created_at timestamptz not null default now()
);

-- Keep denormalized ownership columns on child tables correct.
create or replace function app_private.assign_plan_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.projects where id = new.project_id;
  if owner_id is null then
    raise exception 'Project % does not exist', new.project_id;
  end if;
  new.user_id = owner_id;
  return new;
end;
$$;

create or replace function app_private.assign_module_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.plans where id = new.plan_id;
  if owner_id is null then
    raise exception 'Plan % does not exist', new.plan_id;
  end if;
  new.user_id = owner_id;
  return new;
end;
$$;

create or replace function app_private.assign_module_version_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.plan_modules where id = new.module_id;
  if owner_id is null then
    raise exception 'Plan module % does not exist', new.module_id;
  end if;
  new.user_id = owner_id;
  return new;
end;
$$;

create or replace function app_private.validate_generation_record_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  related_owner uuid;
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;

  if new.user_id is null then
    raise exception 'A generation record requires a user_id';
  end if;

  if new.project_id is not null then
    select user_id into related_owner from public.projects where id = new.project_id;
    if related_owner is distinct from new.user_id then
      raise exception 'Project ownership does not match generation record ownership';
    end if;
  end if;

  if new.plan_id is not null then
    select user_id into related_owner from public.plans where id = new.plan_id;
    if related_owner is distinct from new.user_id then
      raise exception 'Plan ownership does not match generation record ownership';
    end if;
  end if;

  if new.module_id is not null then
    select user_id into related_owner from public.plan_modules where id = new.module_id;
    if related_owner is distinct from new.user_id then
      raise exception 'Module ownership does not match generation record ownership';
    end if;
  end if;

  return new;
end;
$$;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute procedure app_private.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure app_private.set_updated_at();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at before update on public.plans
  for each row execute procedure app_private.set_updated_at();

drop trigger if exists plan_modules_set_updated_at on public.plan_modules;
create trigger plan_modules_set_updated_at before update on public.plan_modules
  for each row execute procedure app_private.set_updated_at();

drop trigger if exists plans_assign_user_id on public.plans;
create trigger plans_assign_user_id before insert or update of project_id on public.plans
  for each row execute procedure app_private.assign_plan_user_id();

drop trigger if exists plan_modules_assign_user_id on public.plan_modules;
create trigger plan_modules_assign_user_id before insert or update of plan_id on public.plan_modules
  for each row execute procedure app_private.assign_module_user_id();

drop trigger if exists plan_module_versions_assign_user_id on public.plan_module_versions;
create trigger plan_module_versions_assign_user_id before insert or update of module_id on public.plan_module_versions
  for each row execute procedure app_private.assign_module_version_user_id();

drop trigger if exists ai_generation_records_validate_owner on public.ai_generation_records;
create trigger ai_generation_records_validate_owner before insert or update on public.ai_generation_records
  for each row execute procedure app_private.validate_generation_record_owner();

-- Creates one profile for every newly registered Supabase Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role, plan)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    'user',
    'free'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- A private function avoids RLS recursion when an admin profile reads all rows.
create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function app_private.assign_plan_user_id() from public;
revoke all on function app_private.assign_module_user_id() from public;
revoke all on function app_private.assign_module_version_user_id() from public;
revoke all on function app_private.validate_generation_record_owner() from public;
revoke all on function app_private.set_updated_at() from public;
revoke all on function app_private.is_admin() from public;
grant execute on function app_private.is_admin() to authenticated;

-- Minimum indexes for project lists, plan rendering, history, and admin logs.
create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);
create index if not exists projects_user_status_updated_idx on public.projects (user_id, status, updated_at desc);
create index if not exists plans_project_version_idx on public.plans (project_id, version_number desc);
create index if not exists plans_user_created_idx on public.plans (user_id, created_at desc);
create index if not exists plan_modules_plan_sort_idx on public.plan_modules (plan_id, sort_order);
create index if not exists plan_module_versions_module_created_idx on public.plan_module_versions (module_id, created_at desc);
create index if not exists ai_generation_records_user_created_idx on public.ai_generation_records (user_id, created_at desc);
create index if not exists ai_generation_records_project_created_idx on public.ai_generation_records (project_id, created_at desc);
create index if not exists ai_generation_records_status_created_idx on public.ai_generation_records (status, created_at desc);

-- Data API grants and Row Level Security.
revoke all on public.profiles, public.projects, public.plans, public.plan_modules,
  public.plan_module_versions, public.ai_generation_records from anon;
revoke all on public.profiles, public.projects, public.plans, public.plan_modules,
  public.plan_module_versions, public.ai_generation_records from authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.plans, public.plan_modules to authenticated;
grant select, insert on public.plan_module_versions, public.ai_generation_records to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.plans enable row level security;
alter table public.plan_modules enable row level security;
alter table public.plan_module_versions enable row level security;
alter table public.ai_generation_records enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Profiles: owner or admin can read" on public.profiles;
drop policy if exists "Profiles: owner can update display name" on public.profiles;
create policy "Profiles: owner or admin can read" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select app_private.is_admin()));
create policy "Profiles: owner can update display name" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Projects: owner or admin can read" on public.projects;
drop policy if exists "Projects: owner can create" on public.projects;
drop policy if exists "Projects: owner can update" on public.projects;
drop policy if exists "Projects: owner can delete" on public.projects;
create policy "Projects: owner or admin can read" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id or (select app_private.is_admin()));
create policy "Projects: owner can create" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Projects: owner can update" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Projects: owner can delete" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Plans: owner or admin can read" on public.plans;
drop policy if exists "Plans: owner can create" on public.plans;
drop policy if exists "Plans: owner can update" on public.plans;
drop policy if exists "Plans: owner can delete" on public.plans;
create policy "Plans: owner or admin can read" on public.plans
  for select to authenticated
  using ((select auth.uid()) = user_id or (select app_private.is_admin()));
create policy "Plans: owner can create" on public.plans
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Plans: owner can update" on public.plans
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Plans: owner can delete" on public.plans
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Plan modules: owner or admin can read" on public.plan_modules;
drop policy if exists "Plan modules: owner can create" on public.plan_modules;
drop policy if exists "Plan modules: owner can update" on public.plan_modules;
drop policy if exists "Plan modules: owner can delete" on public.plan_modules;
create policy "Plan modules: owner or admin can read" on public.plan_modules
  for select to authenticated
  using ((select auth.uid()) = user_id or (select app_private.is_admin()));
create policy "Plan modules: owner can create" on public.plan_modules
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Plan modules: owner can update" on public.plan_modules
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Plan modules: owner can delete" on public.plan_modules
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Module versions: owner or admin can read" on public.plan_module_versions;
drop policy if exists "Module versions: owner can append" on public.plan_module_versions;
create policy "Module versions: owner or admin can read" on public.plan_module_versions
  for select to authenticated
  using ((select auth.uid()) = user_id or (select app_private.is_admin()));
create policy "Module versions: owner can append" on public.plan_module_versions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Generation records: owner or admin can read" on public.ai_generation_records;
drop policy if exists "Generation records: owner can append" on public.ai_generation_records;
create policy "Generation records: owner or admin can read" on public.ai_generation_records
  for select to authenticated
  using ((select auth.uid()) = user_id or (select app_private.is_admin()));
create policy "Generation records: owner can append" on public.ai_generation_records
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
