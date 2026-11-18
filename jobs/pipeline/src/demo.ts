import { CLIENTS, ORG, SITES, USERS, collectDemo } from "@reportpilot/demo";
import type { Collectors } from "./stages/collect";
import type { PipelineSite } from "./store";

/**
 * Demo wiring: the bundled sample agency as pipeline sites, and collectors
 * that return generated data shaped exactly like the real APIs' output.
 */
export function demoSites(): PipelineSite[] {
  return SITES.map((s) => {
    const c = CLIENTS.find((x) => x.id === s.clientId)!;
    return {
      id: s.id,
      orgId: ORG.id,
      clientName: c.name,
      url: s.url,
      gscProperty: s.gscProperty,
      brandedRegex: s.brandedRegex,
      keyPages: s.keyPages,
      timezone: c.timezone,
      reportDay: c.reportDay,
      autoSend: c.autoSend,
      aiEnabled: c.aiEnabled,
      contacts: [c.contact],
      managerName: USERS.find((u) => u.id === c.manager)?.name ?? ORG.name,
      brand: { name: ORG.name, primary: ORG.primary, accent: ORG.accent, footer: ORG.footer, senderName: ORG.senderName, senderEmail: ORG.senderEmail },
    };
  });
}

/** Collectors backed by the demo generator. The Search Console stand-in reports every month as final. */
export function demoCollectors(period: string): Collectors {
  const cache = new Map<string, ReturnType<typeof collectDemo>>();
  const get = (siteId: string) => {
    if (!cache.has(siteId)) cache.set(siteId, collectDemo(siteId, period));
    return cache.get(siteId)!;
  };
  const bySite = new Map(SITES.map((s) => [s.gscProperty, s.id]));
  return {
    gsc: {
      isMonthFinal: async () => true,
      month: async (property: string, p: string) => {
        const id = bySite.get(property)!;
        const d = get(id).search!;
        if (p === period) return d.current;
        if (d.previous?.period === p) return d.previous;
        if (d.yearAgo?.period === p) return d.yearAgo;
        const t = d.trailing.find((x) => x.period === p);
        if (!t) throw new Error(`No demo data for ${p}`);
        return { ...d.current, period: p, totals: { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position } };
      },
    } as unknown as Collectors["gsc"],
    speedSnapshot: async (siteId) => get(siteId).speed,
    uptime: async (siteId) => get(siteId).uptime,
    indexing: async (siteId) => get(siteId).indexing,
  };
}
