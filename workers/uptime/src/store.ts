import type { MonitoredSite, CheckResult } from "./check";

/**
 * Persistence used by the worker. Kept as an interface so the monitor
 * logic is tested against an in-memory store, and production talks to
 * Postgres through postgres.js over Cloudflare's TCP sockets.
 */
export interface UptimeStore {
  activeSites(): Promise<MonitoredSite[]>;
  recordCheck(siteId: string, at: Date, result: CheckResult): Promise<void>;
  openIncident(siteId: string, at: Date, cause: string): Promise<string>;
  resolveIncident(incidentId: string, at: Date): Promise<void>;
  markNotified(incidentId: string, at: Date): Promise<void>;
  rollupDay(day: string): Promise<number>;
  deleteChecksBefore(cutoff: Date): Promise<number>;
}

export function postgresStore(sql: import("postgres").Sql): UptimeStore {
  return {
    async activeSites() {
      const rows = await sql<Array<{
        id: string; url: string; keyword: string | null; client_name: string; notify: string | null; open_incident: string | null;
      }>>`
        select s.id, s.url, s.uptime_keyword as keyword, c.name as client_name, u.email as notify,
               (select i.id from incidents i where i.site_id = s.id and i.resolved_at is null order by i.started_at desc limit 1) as open_incident
        from sites s
        join clients c on c.id = s.client_id
        left join users u on u.id = c.manager_id
        where s.active and c.status = 'active'`;
      return rows.map((r) => ({
        id: r.id, url: r.url, keyword: r.keyword, clientName: r.client_name, notify: r.notify,
        openIncidentId: r.open_incident, state: r.open_incident ? "down" : "up",
      }));
    },
    async recordCheck(siteId, at, r) {
      await sql`insert into uptime_checks (site_id, checked_at, ok, status, ms, error)
                values (${siteId}, ${at}, ${r.ok}, ${r.status}, ${r.ms}, ${r.error})
                on conflict do nothing`;
    },
    async openIncident(siteId, at, cause) {
      const [row] = await sql<Array<{ id: string }>>`insert into incidents (site_id, started_at, cause) values (${siteId}, ${at}, ${cause}) returning id`;
      return row!.id;
    },
    async resolveIncident(id, at) {
      await sql`update incidents set resolved_at = ${at} where id = ${id} and resolved_at is null`;
    },
    async markNotified(id, at) {
      await sql`update incidents set notified_at = ${at} where id = ${id}`;
    },
    async rollupDay(day) {
      const rows = await sql`
        insert into uptime_daily (site_id, day, uptime_pct, avg_ms, p95_ms, incidents)
        select c.site_id, ${day}::date,
               100.0 * avg(case when c.ok then 1 else 0 end),
               coalesce(round(avg(c.ms) filter (where c.ok)), 0),
               coalesce(percentile_disc(0.95) within group (order by c.ms) filter (where c.ok), 0),
               (select count(*) from incidents i where i.site_id = c.site_id and i.started_at::date = ${day}::date)
        from uptime_checks c
        where c.checked_at >= ${day}::date and c.checked_at < ${day}::date + interval '1 day'
        group by c.site_id
        on conflict (site_id, day) do update set
          uptime_pct = excluded.uptime_pct, avg_ms = excluded.avg_ms, p95_ms = excluded.p95_ms, incidents = excluded.incidents
        returning site_id`;
      return rows.length;
    },
    async deleteChecksBefore(cutoff) {
      const rows = await sql`delete from uptime_checks where checked_at < ${cutoff} returning site_id`;
      return rows.length;
    },
  };
}
