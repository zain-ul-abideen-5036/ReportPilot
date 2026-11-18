-- Row-level security for Supabase deployments.
-- The application already scopes every query by organisation; these
-- policies are a second line of defence if a query ever forgets.
--
-- Assumes Supabase Auth, where auth.uid() is the signed-in user's id and
-- users.id matches it. Apply after the Drizzle migrations:
--   psql "$DATABASE_URL" -f packages/db/sql/row-level-security.sql

create or replace function app_user_orgs() returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid()
$$;

alter table organizations enable row level security;
alter table memberships   enable row level security;
alter table clients       enable row level security;
alter table sites         enable row level security;
alter table reports       enable row level security;
alter table alerts        enable row level security;
alter table audit_log     enable row level security;

create policy org_members_read on organizations
  for select using (id in (select app_user_orgs()));

create policy own_memberships on memberships
  for select using (user_id = auth.uid());

create policy org_clients on clients
  for all using (org_id in (select app_user_orgs()));

create policy org_sites on sites
  for all using (client_id in (select id from clients where org_id in (select app_user_orgs())));

create policy org_reports on reports
  for all using (site_id in (
    select s.id from sites s join clients c on c.id = s.client_id
    where c.org_id in (select app_user_orgs())
  ));

create policy org_alerts on alerts
  for all using (site_id in (
    select s.id from sites s join clients c on c.id = s.client_id
    where c.org_id in (select app_user_orgs())
  ));

-- The audit log is append-only for members: they can read and insert, never edit.
create policy org_audit_read on audit_log
  for select using (org_id in (select app_user_orgs()));
create policy org_audit_insert on audit_log
  for insert with check (org_id in (select app_user_orgs()));

-- Only owners may change organisation branding.
create policy owners_update_org on organizations
  for update using (id in (select org_id from memberships where user_id = auth.uid() and role = 'owner'));
