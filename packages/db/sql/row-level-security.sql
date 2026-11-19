-- Row-level security: a second line of defence.
--
-- The dashboard already scopes every query by organisation in code
-- (packages/db/src/repo.ts, covered by tests that try to read another
-- agency's rows). These policies make Postgres enforce the same rule for
-- any connection that is not the table owner, so a forgotten WHERE clause
-- or a leaked read-only credential still cannot cross agencies.
--
-- The signed-in user is passed per transaction:
--   select set_config('app.user_id', '<uuid>', true);
-- On Supabase, auth.uid() is used instead when present.
--
-- Apply after the Drizzle migrations:
--   psql "$DATABASE_URL" -f packages/db/sql/row-level-security.sql

create or replace function app_user_id() returns uuid
language plpgsql stable as $$
declare
  uid uuid;
begin
  uid := nullif(current_setting('app.user_id', true), '')::uuid;
  if uid is null and to_regprocedure('auth.uid()') is not null then
    execute 'select auth.uid()' into uid;
  end if;
  return uid;
end
$$;

create or replace function app_user_orgs() returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = app_user_id()
$$;

create or replace function app_org_sites() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.id from sites s join clients c on c.id = s.client_id where c.org_id in (select app_user_orgs())
$$;

alter table organizations    enable row level security;
alter table memberships      enable row level security;
alter table clients          enable row level security;
alter table sites            enable row level security;
alter table reports          enable row level security;
alter table report_versions  enable row level security;
alter table alerts           enable row level security;
alter table audit_log        enable row level security;
alter table job_runs         enable row level security;
alter table incidents        enable row level security;
alter table uptime_daily     enable row level security;
alter table sitemap_status   enable row level security;
alter table index_status     enable row level security;
alter table login_tokens     enable row level security;

create policy org_members_read on organizations
  for select using (id in (select app_user_orgs()));

-- Only owners may change organisation branding.
create policy owners_update_org on organizations
  for update using (id in (select org_id from memberships where user_id = app_user_id() and role = 'owner'));

create policy own_memberships on memberships
  for select using (user_id = app_user_id());

create policy org_clients on clients
  for all using (org_id in (select app_user_orgs()));

create policy org_sites on sites
  for all using (id in (select app_org_sites()));

create policy org_reports on reports
  for all using (site_id in (select app_org_sites()));

create policy org_report_versions on report_versions
  for select using (report_id in (select id from reports where site_id in (select app_org_sites())));

create policy org_alerts on alerts
  for all using (site_id in (select app_org_sites()));

create policy org_job_runs on job_runs
  for select using (site_id in (select app_org_sites()));

create policy org_incidents on incidents
  for select using (site_id in (select app_org_sites()));

create policy org_uptime_daily on uptime_daily
  for select using (site_id in (select app_org_sites()));

create policy org_sitemaps on sitemap_status
  for select using (site_id in (select app_org_sites()));

create policy org_index_status on index_status
  for select using (site_id in (select app_org_sites()));

-- The audit log is append-only for members: they can read and insert, never edit.
create policy org_audit_read on audit_log
  for select using (org_id in (select app_user_orgs()));
create policy org_audit_insert on audit_log
  for insert with check (org_id in (select app_user_orgs()));

-- Sign-in tokens are only ever touched by the server's own role; no policy means no access for anyone else.
