import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { ApiError, requestJson, type FetchLike } from "../src/http";
import { GoogleAuth, signAssertion, parseServiceAccount } from "../src/google-auth";
import { MAX_ROWS, SearchConsole } from "../src/gsc";
import { parsePsi, pickMedianRun, type PsiResponse } from "../src/psi";
import { parseHistory } from "../src/crux";
import { parseExpiry, registrableDomain } from "../src/rdap";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("requestJson", () => {
  it("retries 429 and 5xx with backoff, then succeeds", async () => {
    const fetch = vi.fn<FetchLike>()
      .mockResolvedValueOnce(json({ error: { message: "Quota exceeded" } }, 429))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ ok: true }));
    const sleep = vi.fn(async () => {});
    await expect(requestJson("https://x.test", {}, { api: "Test", fetch, sleep, baseDelayMs: 0 })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry client errors and names the API", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(json({ error: { message: "User does not have sufficient permission" } }, 403));
    const err = (await requestJson("https://x.test", {}, { api: "Search Console", fetch, baseDelayMs: 0 }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Search Console: 403 User does not have sufficient permission");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after the configured retries", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(json({}, 500));
    await expect(requestJson("https://x.test", {}, { api: "T", fetch, retries: 2, sleep: async () => {}, baseDelayMs: 0 })).rejects.toThrow("T: 500");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("service account auth", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = { client_email: "reports@test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

  it("signs a verifiable RS256 assertion with the read-only scope", () => {
    const jwt = signAssertion(sa, "https://www.googleapis.com/auth/webmasters.readonly", 1_700_000_000);
    const [h, c, s] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(c!, "base64url").toString());
    expect(claims).toMatchObject({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", exp: 1_700_003_600 });
    const ok = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s!, "base64url"));
    expect(ok).toBe(true);
  });

  it("caches tokens until shortly before expiry", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(json({ access_token: "tok", expires_in: 3600 }));
    const auth = new GoogleAuth(sa, fetch);
    await auth.token();
    await auth.token();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("unescapes newlines in keys stored as CI secrets", () => {
    const parsed = parseServiceAccount(JSON.stringify({ client_email: "a@b", private_key: "-----BEGIN-----\\nabc\\n-----END-----" }));
    expect(parsed.private_key).toContain("\nabc\n");
  });
});

describe("Search Console", () => {
  const auth = { token: async () => "tok" } as unknown as GoogleAuth;

  it("paginates with startRow until a short page", async () => {
    const pages = [MAX_ROWS, MAX_ROWS, 120];
    const bodies: Array<{ startRow: number; dataState: string }> = [];
    const fetch: FetchLike = async (_url, init) => {
      const body = JSON.parse(String(init!.body));
      bodies.push(body);
      const n = pages[bodies.length - 1] ?? 0;
      return json({ rows: Array.from({ length: n }, (_, i) => ({ keys: [`q${i}`], clicks: 1, impressions: 10, ctr: 0.1, position: 5 })) });
    };
    const rows = await new SearchConsole(auth, fetch).queryAll("sc-domain:example.test", { startDate: "2026-10-01", endDate: "2026-10-31", dimensions: ["query"] });
    expect(rows).toHaveLength(MAX_ROWS * 2 + 120);
    expect(bodies.map((b) => b.startRow)).toEqual([0, MAX_ROWS, MAX_ROWS * 2]);
    expect(bodies.every((b) => b.dataState === "final")).toBe(true);
  });

  it("knows a month is final only when its last day is present", async () => {
    const days = (last: number) => json({ rows: Array.from({ length: last }, (_, i) => ({ keys: [`2026-10-${String(i + 1).padStart(2, "0")}`], clicks: 1, impressions: 1, ctr: 1, position: 1 })) });
    expect(await new SearchConsole(auth, async () => days(29)).isMonthFinal("p", "2026-10")).toBe(false);
    expect(await new SearchConsole(auth, async () => days(31)).isMonthFinal("p", "2026-10")).toBe(true);
  });

  it("encodes domain properties in the URL", async () => {
    let seen = "";
    await new SearchConsole(auth, async (url) => { seen = url; return json({}); }).queryPage("sc-domain:example.test", { startDate: "a", endDate: "b" });
    expect(seen).toContain("sites/sc-domain%3Aexample.test/searchAnalytics/query");
  });

  it("asks for fresh data for the daily alert sync and sorts the days", async () => {
    let body: { dataState?: string; dimensions?: string[] } = {};
    const fetch: FetchLike = async (_u, init) => {
      body = JSON.parse(String(init!.body));
      return json({ rows: [
        { keys: ["2026-11-02"], clicks: 5, impressions: 50, ctr: 0.1, position: 4 },
        { keys: ["2026-11-01"], clicks: 3, impressions: 40, ctr: 0.075, position: 5 },
      ] });
    };
    const days = await new SearchConsole(auth, fetch).daily("p", "2026-11-01", "2026-11-02", "all");
    expect(body.dataState).toBe("all");
    expect(body.dimensions).toEqual(["date"]);
    expect(days.map((d) => d.day)).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("reads sitemaps.list errors, warnings and submitted counts", async () => {
    const fetch: FetchLike = async (url) => {
      expect(url).toContain("/sitemaps");
      return json({ sitemap: [{
        path: "https://example.test/sitemap.xml", errors: "2", warnings: "1", lastDownloaded: "2026-10-30T04:00:00Z",
        contents: [{ type: "web", submitted: "120" }, { type: "image", submitted: "30" }],
      }] });
    };
    expect(await new SearchConsole(auth, fetch).sitemaps("p")).toEqual([
      { path: "https://example.test/sitemap.xml", errors: 2, warnings: 1, submitted: 150, lastDownloaded: "2026-10-30T04:00:00Z" },
    ]);
  });
});

describe("PageSpeed Insights", () => {
  const run = parsePsi("https://example.test/", "mobile", fixture<PsiResponse>("psi-mobile.json"));

  it("reads the lab score and metrics", () => {
    expect(run.lab).toEqual({ url: "https://example.test/", strategy: "mobile", score: 71, lcp: 3185, cls: 0.042, tbt: 268 });
  });

  it("reads field data, converting CLS from CrUX's x100 form", () => {
    expect(run.field).toEqual({ lcp: 2380, inp: 164, cls: 0.04 });
  });

  it("keeps only opportunities with savings, largest first", () => {
    expect(run.opportunities.map((o) => o.id)).toEqual(["unused-javascript", "render-blocking-resources"]);
  });

  it("picks the run whose score is the median", () => {
    const withScore = (score: number) => ({ ...run, lab: { ...run.lab, score } });
    expect(pickMedianRun([withScore(62), withScore(91), withScore(70)]).lab.score).toBe(70);
  });
});

describe("CrUX History", () => {
  it("zips collection periods with p75 series and tolerates gaps", () => {
    expect(parseHistory(fixture("crux-history.json"))).toEqual([
      { week: "2026-10-04", lcp: 2510, inp: 171, cls: 0.06 },
      { week: "2026-10-11", lcp: 2440, inp: null, cls: 0.05 },
      { week: "2026-10-18", lcp: 2390, inp: 158, cls: null },
    ]);
  });
});

describe("RDAP", () => {
  it("finds the registrable domain, including two-part suffixes", () => {
    expect(registrableDomain("https://www.harlowfinch.co.uk/book/")).toBe("harlowfinch.co.uk");
    expect(registrableDomain("https://shop.example.com")).toBe("example.com");
  });

  it("reads the expiration event", () => {
    expect(parseExpiry({ events: [{ eventAction: "registration", eventDate: "2019-01-01T00:00:00Z" }, { eventAction: "expiration", eventDate: "2027-03-14T10:00:00Z" }] }))
      .toBe("2027-03-14T10:00:00.000Z");
    expect(parseExpiry({})).toBeNull();
  });
});
