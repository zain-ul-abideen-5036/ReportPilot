import { addMonths, trailingPeriods, type CollectedData } from "@reportpilot/core";
import { DEMO_PERIOD, type DemoSite } from "./agency";
import { indexing, monthSearch, speedSnapshot, uptimeMonth } from "./generate";
import { createRng, hash, between, intBetween } from "./random";

/**
 * A site added through the onboarding wizard in demo mode. There is no
 * Search Console behind it, so its history is generated, seeded by the
 * URL: the same address always produces the same report, and the 16
 * months of "backfill" give the first report year-on-year figures exactly
 * as the real backfill would.
 */

export interface OnboardedSiteInput {
  id: string;
  clientId: string;
  name: string;
  url: string;
  keyPages: string[];
  brandedRegex: string | null;
  uptimeKeyword: string | null;
}

const SERVICES = ["services", "prices", "near me", "reviews", "booking", "contact", "opening hours", "best", "local", "quote"];
const PLACES = ["london", "manchester", "leeds", "bristol", "near me"];

export function onboardedSite(input: OnboardedSiteInput): DemoSite {
  const rng = createRng(hash(input.url));
  const host = new URL(input.url).hostname.replace(/^www\./, "");
  const brandWord = input.name.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).join(" ") || host.split(".")[0]!;
  const keyPages = input.keyPages.length ? input.keyPages : ["/"];
  return {
    id: input.id,
    clientId: input.clientId,
    url: input.url.endsWith("/") ? input.url : `${input.url}/`,
    gscProperty: `sc-domain:${host}`,
    brandedRegex: input.brandedRegex || brandWord.split(" ")[0]!,
    keyPages,
    uptimeKeyword: input.uptimeKeyword ?? input.name,
    topic: {
      services: SERVICES.map((s) => `${brandWord.split(" ").at(-1)} ${s}`),
      places: PLACES,
      brand: [brandWord, `${brandWord} reviews`, `${brandWord} contact`],
    },
    profile: {
      growth: between(rng, -0.01, 0.04),
      baseClicks: intBetween(rng, 40, 220),
      lcp: intBetween(rng, 1800, 3600),
      inp: intBetween(rng, 120, 320),
      cls: Math.round(between(rng, 0.02, 0.18) * 100) / 100,
      outageRate: between(rng, 0, 0.03),
      certDays: intBetween(rng, 25, 85),
      domainDays: intBetween(rng, 60, 330),
    },
  };
}

export function collectOnboarded(site: DemoSite, period: string = DEMO_PERIOD): CollectedData {
  return {
    period,
    site: { url: site.url, brandedPattern: site.brandedRegex },
    search: {
      current: monthSearch(site, period),
      previous: monthSearch(site, addMonths(period, -1)),
      yearAgo: monthSearch(site, addMonths(period, -12)),
      trailing: trailingPeriods(period, 13).map((p) => ({ period: p, ...monthSearch(site, p).totals })),
    },
    speed: speedSnapshot(site, period),
    uptime: uptimeMonth(site, period),
    indexing: indexing(site, period),
  };
}
