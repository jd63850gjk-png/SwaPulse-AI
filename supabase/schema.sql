-- SwaPulse AI demo schema. Safe to run in Supabase SQL Editor.
-- It creates only the application tables and never grants Milo raw SQL access.

create extension if not exists pgcrypto;

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  facility_type text not null check (facility_type in ('PHC', 'CHC')),
  district text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.facility_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (user_id, facility_id)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null,
  category text not null default 'Medicine',
  unit text not null default 'units',
  current_stock integer not null default 0 check (current_stock >= 0),
  reorder_level integer not null default 10 check (reorder_level >= 0),
  updated_at timestamptz not null default now(),
  unique (facility_id, name)
);

create table if not exists public.patient_metrics (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  metric_date date not null default current_date,
  outpatient_count integer not null default 0 check (outpatient_count >= 0),
  inpatient_count integer not null default 0 check (inpatient_count >= 0),
  emergency_count integer not null default 0 check (emergency_count >= 0),
  created_at timestamptz not null default now(),
  unique (facility_id, metric_date)
);

create table if not exists public.bed_status (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  ward_name text not null,
  total_beds integer not null default 0 check (total_beds >= 0),
  occupied_beds integer not null default 0 check (occupied_beds >= 0 and occupied_beds <= total_beds),
  available_beds integer generated always as (total_beds - occupied_beds) stored,
  updated_at timestamptz not null default now(),
  unique (facility_id, ward_name)
);

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  staff_name text not null,
  staff_role text not null,
  attendance_date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'late', 'leave')),
  created_at timestamptz not null default now(),
  unique (facility_id, staff_name, attendance_date)
);

create table if not exists public.test_availability (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  test_name text not null,
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (facility_id, test_name)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  alert_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  message text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed')),
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  message_role text not null check (message_role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inventory_facility_idx on public.inventory_items(facility_id);
create index if not exists alerts_facility_idx on public.alerts(facility_id, status);
create index if not exists chat_facility_idx on public.chat_messages(facility_id, created_at);

create or replace function public.is_facility_member(target_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from public.facility_members
    where user_id = auth.uid()
      and facility_id = target_facility_id
  );
$func$;

create or replace function public.join_demo_facility()
returns uuid
language plpgsql
security definer
set search_path = public
as $demo$
declare
  demo_facility_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id into demo_facility_id
  from public.facilities
  where slug = 'central-demo-phc' and is_demo = true
  limit 1;

  if demo_facility_id is null then
    raise exception 'Demo facility not found';
  end if;

  insert into public.facility_members (user_id, facility_id, role)
  values (auth.uid(), demo_facility_id, 'staff')
  on conflict (user_id, facility_id) do nothing;

  return demo_facility_id;
end;
$demo$;

grant execute on function public.join_demo_facility() to authenticated;

alter table public.facilities enable row level security;
alter table public.facility_members enable row level security;
alter table public.inventory_items enable row level security;
alter table public.patient_metrics enable row level security;
alter table public.bed_status enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.test_availability enable row level security;
alter table public.alerts enable row level security;
alter table public.tasks enable row level security;
alter table public.chat_messages enable row level security;
alter table public.audit_log enable row level security;

grant usage on schema public to authenticated;
grant select on public.facilities, public.facility_members to authenticated;
grant select, insert, update on public.inventory_items to authenticated;
grant select, insert, update on public.patient_metrics to authenticated;
grant select, insert, update on public.bed_status to authenticated;
grant select, insert, update on public.staff_attendance to authenticated;
grant select, insert, update on public.test_availability to authenticated;
grant select, insert, update on public.alerts to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert on public.audit_log to authenticated;

drop policy if exists facilities_read on public.facilities;
create policy facilities_read on public.facilities
for select to authenticated
using (is_demo = true or public.is_facility_member(id));

drop policy if exists facility_members_read on public.facility_members;
create policy facility_members_read on public.facility_members
for select to authenticated
using (user_id = auth.uid());

do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_items',
    'patient_metrics',
    'bed_status',
    'staff_attendance',
    'test_availability',
    'alerts',
    'tasks'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_facility_member(facility_id))',
      table_name || '_read', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_facility_member(facility_id))',
      table_name || '_insert', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id))',
      table_name || '_update', table_name
    );
  end loop;
end;
$policies$;

drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages
for select to authenticated
using (public.is_facility_member(facility_id));

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
for insert to authenticated
with check (
  public.is_facility_member(facility_id)
  and (user_id is null or user_id = auth.uid())
);

drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log
for select to authenticated
using (public.is_facility_member(facility_id));

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
for insert to authenticated
with check (
  public.is_facility_member(facility_id)
  and (actor_id is null or actor_id = auth.uid())
);

insert into public.facilities (slug, name, facility_type, district, is_demo)
values ('central-demo-phc', 'Central Demo PHC', 'PHC', 'SwaPulse District', true)
on conflict (slug) do update set is_demo = true;

insert into public.inventory_items (facility_id, name, category, unit, current_stock, reorder_level)
select id, 'Paracetamol 500mg', 'Medicine', 'tablets', 420, 100
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, name) do nothing;

insert into public.inventory_items (facility_id, name, category, unit, current_stock, reorder_level)
select id, 'ORS Sachets', 'Medicine', 'sachets', 38, 50
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, name) do nothing;

insert into public.inventory_items (facility_id, name, category, unit, current_stock, reorder_level)
select id, 'Amoxicillin 250mg', 'Medicine', 'capsules', 72, 80
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, name) do nothing;

insert into public.patient_metrics (
  facility_id, metric_date, outpatient_count, inpatient_count, emergency_count
)
select id, current_date, 184, 12, 7
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, metric_date) do nothing;

insert into public.bed_status (facility_id, ward_name, total_beds, occupied_beds)
select id, 'General Ward', 30, 24
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, ward_name) do nothing;

insert into public.bed_status (facility_id, ward_name, total_beds, occupied_beds)
select id, 'Maternity Ward', 12, 9
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, ward_name) do nothing;

insert into public.staff_attendance (facility_id, staff_name, staff_role, attendance_date, status)
select id, 'Dr. Ananya Singh', 'Doctor', current_date, 'present'
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, staff_name, attendance_date) do nothing;

insert into public.staff_attendance (facility_id, staff_name, staff_role, attendance_date, status)
select id, 'Dr. Raj Mehta', 'Doctor', current_date, 'absent'
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, staff_name, attendance_date) do nothing;

insert into public.test_availability (facility_id, test_name, is_available)
select id, 'Complete Blood Count', true
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, test_name) do nothing;

insert into public.test_availability (facility_id, test_name, is_available)
select id, 'Malaria Test', false
from public.facilities where slug = 'central-demo-phc'
on conflict (facility_id, test_name) do nothing;

insert into public.alerts (facility_id, alert_type, severity, message, status)
select id, 'stock', 'high', 'ORS sachets are below the recommended reorder level.', 'open'
from public.facilities
where slug = 'central-demo-phc'
  and not exists (
    select 1 from public.alerts
    where alert_type = 'stock'
      and message = 'ORS sachets are below the recommended reorder level.'
  );
