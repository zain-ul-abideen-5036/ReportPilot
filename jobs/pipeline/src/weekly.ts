import { eq } from "drizzle-orm";
import { createDb, tables } from "@reportpilot/db";
import {
  CruxHistory, GoogleAuth, PageSpeed, SearchConsole, certificateInfo, domainExpiry, parseServiceAccount,
} from "@reportpilot/integrations";
import { SITES } from "@reportpilot/demo";
import type { Logger } from "./log";

/**
 * Weekly snapshot (Mondays 05:00 UTC): PageSpeed median of three for the
 * homepage and up to five key pages on mobile and desktop, CrUX history,
 * URL Inspection for key pages, sitemaps.list errors, and SSL and domain expiry.
 * Each site and each source is independent; one failure is logged and skipped.
 */
export async function runWeekly({ log, demo }: { log: Logger; demo: boolean }) {
  if (demo) {
    log.info("weekly snapshot (demo): nothing to fetch, demo data is generated on demand", { sites: SITES.length });
    return;
  }
  const db = createDb();
  const psi = new PageSpeed(process.env.PAGESPEED_API_KEY);
  const crux = process.env.PAGESPEED_API_KEY ? new CruxHistory(process.env.PAGESPEED_API_KEY) : null;
  const gsc = new SearchConsole(new GoogleAuth(parseServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)));
  const today = new Date().toISOString().slice(0, 10);
  const sites = await db.select().from(tables.sites).where(eq(tables.sites.active, true));

  for (const site of sites) {
    const slog = log.child({ siteId: site.id });
    const pages = [...new Set(["/", ...site.keyPages])].slice(0, 6).map((p) => new URL(p, site.url).toString());

    for (const url of pages) {
      for (const strategy of ["mobile", "desktop"] as const) {
        try {
          const run = await psi.medianOfThree(url, strategy);
          await db.insert(tables.psiRuns).values({
            siteId: site.id, url, strategy, runDate: today, perfScore: run.lab.score, lcp: run.lab.lcp,
            cls: run.lab.cls, tbt: run.lab.tbt, opportunities: run.opportunities.slice(0, 5),
          }).onConflictDoNothing();
        } catch (err) {
          slog.warn("pagespeed failed", { url, strategy, error: (err as Error).message });
        }
      }
    }

    if (crux) {
      try {
        const weeks = await crux.weekly({ origin: new URL(site.url).origin });
        for (const w of weeks) {
          await db.insert(tables.cruxWeekly).values({
            siteId: site.id, urlOrOrigin: new URL(site.url).origin, week: w.week, formFactor: "PHONE",
            lcpP75: w.lcp, inpP75: w.inp, clsP75: w.cls,
          }).onConflictDoNothing();
        }
      } catch (err) {
        slog.warn("crux failed", { error: (err as Error).message });
      }
    }

    if (site.gscProperty) {
      for (const url of pages.slice(0, 5)) {
        try {
          const r = await gsc.inspect(site.gscProperty, url);
          await db.insert(tables.indexStatus).values({
            siteId: site.id, url, checkedAt: new Date(), verdict: r.verdict, coverageState: r.coverageState,
            lastCrawl: r.lastCrawl ? new Date(r.lastCrawl) : null,
          });
        } catch (err) {
          slog.warn("url inspection failed", { url, error: (err as Error).message });
        }
      }

      try {
        const maps = await gsc.sitemaps(site.gscProperty);
        for (const m of maps) {
          const values = {
            errors: m.errors, warnings: m.warnings, submitted: m.submitted,
            lastDownloaded: m.lastDownloaded ? new Date(m.lastDownloaded) : null, checkedAt: new Date(),
          };
          await db.insert(tables.sitemapStatus).values({ siteId: site.id, path: m.path, ...values })
            .onConflictDoUpdate({ target: [tables.sitemapStatus.siteId, tables.sitemapStatus.path], set: values });
        }
      } catch (err) {
        slog.warn("sitemaps failed", { error: (err as Error).message });
      }
    }

    try {
      const [cert, domain] = await Promise.all([certificateInfo(site.url).catch(() => null), domainExpiry(site.url).catch(() => null)]);
      await db.insert(tables.tlsDomain).values({
        siteId: site.id, certExpiresAt: cert ? new Date(cert.expiresAt) : null, issuer: cert?.issuer ?? null,
        domainExpiresAt: domain ? new Date(domain) : null, checkedAt: new Date(),
      }).onConflictDoUpdate({
        target: tables.tlsDomain.siteId,
        set: { certExpiresAt: cert ? new Date(cert.expiresAt) : null, issuer: cert?.issuer ?? null, domainExpiresAt: domain ? new Date(domain) : null, checkedAt: new Date() },
      });
    } catch (err) {
      slog.warn("expiry check failed", { error: (err as Error).message });
    }
    slog.info("weekly snapshot done", { pages: pages.length });
  }
}
