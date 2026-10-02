-- Apply with a trusted migration role; never expose this role to clients.
create schema if not exists portal;
revoke all on schema portal from public, anon;
grant usage on schema portal to authenticated, service_role;
create table portal.profiles (id uuid primary key references auth.users(id), active boolean not null default true, admin boolean not null default false);
create table portal.businesses (id uuid primary key, name text not null);
create table portal.memberships (business_id uuid references portal.businesses, actor_id uuid references portal.profiles, role text not null check(role in ('owner','member')), active boolean not null default true, primary key(business_id,actor_id));
create table portal.projects (id uuid primary key, business_id uuid not null references portal.businesses, name text not null);
create table portal.project_grants (project_id uuid references portal.projects, actor_id uuid references portal.profiles, active boolean not null default true, primary key(project_id,actor_id));
create table portal.milestones (id uuid primary key, project_id uuid not null references portal.projects, version integer not null check(version>0), status text not null check(status in ('awaiting','approved')));
create table portal.approvals (milestone_id uuid references portal.milestones, version integer not null, actor_id uuid not null references portal.profiles, approved_at timestamptz not null default now(), primary key(milestone_id,version));
create table portal.receipts (actor_id uuid references portal.profiles, operation_id uuid, project_id uuid not null references portal.projects, payload jsonb not null, result jsonb not null, primary key(actor_id,operation_id));
create table portal.outbox (id bigint generated always as identity primary key, actor_id uuid not null references portal.profiles, operation_id uuid not null, payload jsonb not null, created_at timestamptz not null default now(), unique(actor_id,operation_id));
create function portal.can_view_project(target uuid) returns boolean language sql stable security definer set search_path = pg_catalog as $$
select auth.uid() is not null and exists(select 1 from portal.profiles p where p.id=auth.uid() and p.active and (p.admin or exists(select 1 from portal.projects j join portal.memberships m on m.business_id=j.business_id join portal.project_grants g on g.project_id=j.id and g.actor_id=m.actor_id where j.id=target and m.actor_id=p.id and m.active and g.active)))
$$;
create function portal.can_view_business(target uuid) returns boolean language sql stable security definer set search_path = pg_catalog as $$
select auth.uid() is not null and exists(select 1 from portal.profiles p where p.id=auth.uid() and p.active and (p.admin or exists(select 1 from portal.memberships m where m.business_id=target and m.actor_id=p.id and m.active)))
$$;
create function portal.approve_milestone(target uuid, expected_version integer, operation uuid) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare actor uuid := auth.uid(); profile portal.profiles%rowtype; item portal.milestones%rowtype; project portal.projects%rowtype; member portal.memberships%rowtype; access portal.project_grants%rowtype; old portal.receipts%rowtype; request jsonb; answer jsonb;
begin
if actor is null or operation is null or expected_version is null or target is null then raise exception 'invalid request' using errcode='42501'; end if;
-- Serialize operation IDs per actor, including competing calls for different targets.
perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || operation::text,0));
select * into profile from portal.profiles where id=actor for share;
if not found or not profile.active or profile.admin then raise exception 'client owner required' using errcode='42501'; end if;
-- Milestone is locked before its project; all approval callers use this order.
select * into item from portal.milestones where id=target for update;
if not found then raise exception 'access denied' using errcode='42501'; end if;
select * into project from portal.projects where id=item.project_id for share;
select * into member from portal.memberships where business_id=project.business_id and actor_id=actor for share;
if not found or not member.active or member.role <> 'owner' then raise exception 'owner required' using errcode='42501'; end if;
select * into access from portal.project_grants where project_id=project.id and actor_id=actor for share;
if not found or not access.active then raise exception 'project access denied' using errcode='42501'; end if;
request := pg_catalog.jsonb_build_object('action','approve','milestone',target,'version',expected_version);
select * into old from portal.receipts where actor_id=actor and operation_id=operation;
if found then
if old.payload <> request then raise exception 'operation payload conflict' using errcode='22023'; end if;
return old.result;
end if;
if item.version <> expected_version or item.status <> 'awaiting' then raise exception 'stale milestone' using errcode='22023'; end if;
insert into portal.approvals(milestone_id,version,actor_id) values(target,expected_version,actor);
update portal.milestones set status='approved' where id=target;
answer := pg_catalog.jsonb_build_object('milestone',target,'version',expected_version,'status','approved');
insert into portal.receipts values(actor,operation,project.id,request,answer);
insert into portal.outbox(actor_id,operation_id,payload) values(actor,operation,answer);
return answer;
end $$;
revoke all on all functions in schema portal from public, anon, authenticated;
grant execute on function portal.can_view_project(uuid), portal.can_view_business(uuid), portal.approve_milestone(uuid,integer,uuid) to authenticated;
revoke all on all tables in schema portal from public, anon, authenticated;
revoke all on all sequences in schema portal from public, anon, authenticated;
grant all on all tables in schema portal to service_role;
grant all on all sequences in schema portal to service_role;
grant select on portal.profiles,portal.businesses,portal.memberships,portal.projects,portal.project_grants,portal.milestones,portal.approvals,portal.receipts to authenticated;
alter table portal.profiles enable row level security;
alter table portal.businesses enable row level security;
alter table portal.memberships enable row level security;
alter table portal.projects enable row level security;
alter table portal.project_grants enable row level security;
alter table portal.milestones enable row level security;
alter table portal.approvals enable row level security;
alter table portal.receipts enable row level security;
alter table portal.outbox enable row level security;
create policy profiles_read on portal.profiles for select to authenticated using(id=auth.uid() and active);
create policy businesses_read on portal.businesses for select to authenticated using(portal.can_view_business(id));
create policy memberships_read on portal.memberships for select to authenticated using(actor_id=auth.uid() and portal.can_view_business(business_id));
create policy projects_read on portal.projects for select to authenticated using(portal.can_view_project(id));
create policy grants_read on portal.project_grants for select to authenticated using(actor_id=auth.uid() and portal.can_view_project(project_id));
create policy milestones_read on portal.milestones for select to authenticated using(portal.can_view_project(project_id));
create policy approvals_read on portal.approvals for select to authenticated using(exists(select 1 from portal.milestones m where m.id=milestone_id and portal.can_view_project(m.project_id)));
create policy receipts_read on portal.receipts for select to authenticated using(actor_id=auth.uid() and portal.can_view_project(project_id));
