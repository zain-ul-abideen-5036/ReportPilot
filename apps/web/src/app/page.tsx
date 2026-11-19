import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { formatInt, formatSignedPct } from "@reportpilot/core";
import { LandingNav } from "@/components/landing/LandingNav";
import { PageStack } from "@/components/landing/PageStack";
import { Marquee } from "@/components/landing/Marquee";
import { PipelineFlow } from "@/components/landing/PipelineFlow";
import { Photo } from "@/components/landing/Photo";
import { BeforeAfter, CaseStudy, Chapter, Figures, FinalCta, Stack, Trust } from "@/components/landing/Sections";
import { Logo } from "@/components/shell/Logo";
import { ReportDocument } from "@reportpilot/report";
import { sampleSite } from "@/lib/data";

export default function Landing() {
  const { row, org, now } = sampleSite("site_harlow");
  const input = {
    report: row.report,
    narrative: row.narrative,
    org: { name: org.name, primary: org.primary, accent: org.accent, footer: org.footer, initials: "NF" },
    client: { name: row.client.name },
    preparedBy: row.manager.name,
    generatedAt: now.toISOString(),
  };
  const s = row.report.search!;
  const clicks = s.kpis.find((k) => k.key === "clicks")!;
  const missed = s.lowCtr.reduce((n, p) => n + Math.max(0, p.missedClicks), 0);
  const facts = [
    { value: formatInt(clicks.value), label: `organic clicks, ${formatSignedPct(clicks.yoy.pct)} on last October` },
    { value: String(s.strikingDistance.length), label: "keywords ranking 8–20, one push from page one" },
    { value: formatInt(missed), label: "extra clicks a month if one page's title is fixed" },
    { value: `${row.report.uptime!.summary.uptimePct.toFixed(2)}%`, label: "uptime, checked 8,928 times in the month" },
  ];

  return (
    <div className="grain min-h-dvh overflow-x-clip">
      <LandingNav />
      <main>
        {/* Hero: fills one screen on desktop, sized by both width and height. */}
        <section className="glow">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 md:gap-12 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-[clamp(1.5rem,5svh,4.5rem)]">
            <div className="animate-enter">
              <p className="inline-flex items-center gap-2 rounded-full bg-raised px-3 py-1 text-small text-ink-2 shadow-raised">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-full bg-good opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-good" />
                </span>
                For web agencies with monthly retainers
              </p>
              <h1 className="mt-6 font-display text-[clamp(2.5rem,10.6vw,3.4rem)] leading-[0.98] font-normal tracking-[-0.036em] text-ink sm:text-[4.25rem] lg:mt-[clamp(1rem,3.2svh,1.75rem)] lg:text-[clamp(3.25rem,min(5.5vw,9.2svh),5.5rem)]">
                The monthly report, <em className="text-gradient pr-1">written</em> before you start work.
              </h1>
              <p className="mt-6 max-w-[46ch] text-lead text-ink-2 sm:text-[1.125rem] sm:leading-[1.6] lg:mt-[clamp(1rem,3.2svh,1.75rem)] lg:max-w-[52ch]">
                Every client gets a branded PDF on search, speed and uptime, with a plain-English summary of what changed and what to do next.
                ReportPilot drafts it on the 3rd; you read it, add a line, and approve.
              </p>
              <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center lg:mt-[clamp(1.25rem,4svh,2.25rem)]">
                <Link href="/demo" prefetch={false} className="press group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand bg-brand-hover px-6 text-body font-semibold text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_12px_28px_-12px_rgb(29_74_60/0.7)]">
                  Open the demo<ArrowRight size={16} className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <Link href={`/r/${row.shareToken}`} className="press inline-flex h-12 items-center justify-center rounded-full bg-raised px-6 text-body font-medium text-ink-2 hairline hover:text-ink">
                  Read a sample report
                </Link>
              </div>
              <p className="mt-6 text-small text-ink-3 lg:[@media(max-height:760px)]:hidden">Free to run · No accounts for your clients · Demo data, no sign-up</p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <PageStack input={input}>
                <div className="ring-gradient absolute top-[20%] left-0 flex items-center gap-3 rounded-xl px-4 py-3 shadow-sheet motion-safe:animate-[float_7s_ease-in-out_infinite]">
                  <span className="flex size-9 items-center justify-center rounded-full bg-good-soft text-good"><TrendUp size={18} weight="bold" /></span>
                  <span>
                    <span className="block text-micro text-ink-3">Organic clicks, year on year</span>
                    <span className="block font-display text-title text-ink tnum">{formatSignedPct(clicks.yoy.pct)}</span>
                  </span>
                </div>
                <div className="ring-gradient absolute right-0 bottom-[3%] flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-sheet motion-safe:animate-[float_8s_ease-in-out_1.2s_infinite]">
                  <CheckCircle size={20} weight="fill" className="text-accent" />
                  <span className="text-small"><span className="font-semibold text-ink">Approved</span> <span className="text-ink-3">by {row.manager.name.split(" ")[0]} · 09:12</span></span>
                </div>
              </PageStack>
            </div>
          </div>
        </section>

        <Marquee />

        <div className="mx-auto max-w-[1240px] px-4 sm:px-6"><Figures /></div>

        <section className="mx-auto max-w-[1240px] px-4 py-24 sm:px-6 md:py-32">
          <Chapter index="01" kicker="Why it exists" title="Three hours of copy and paste, or ten minutes of reading.">
            Agencies lose 40 to 80 hours a month to reporting. The work is repetitive, the figures drift depending on who pulled them, and problems surface weeks after they happen.
          </Chapter>
          <BeforeAfter />
        </section>

        <section id="how" className="bg-wash relative scroll-mt-20 py-24 md:py-32">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Chapter index="02" kicker="How it works" title="Six stages, all of them unattended but one.">
              On the 3rd of each month, once Google marks the previous month final, a scheduled job works through every site. It stops once, for you.
            </Chapter>
            <PipelineFlow />
          </div>
        </section>

        <section id="report" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-24 sm:px-6 md:py-32">
          <Chapter index="03" kicker="The report" title="Eight pages a business owner will actually read.">
            Status lights and five highlights on the first page. Search, opportunities, speed and uptime after it. Every figure is calculated the same way every month, and an appendix says exactly how.
          </Chapter>
          <div className="mt-14 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <ul className="reveal flex flex-col">
              {[
                ["Executive summary", "Three status lights and the month's highlights in plain English."],
                ["Opportunities", "Keywords one push from page one, and pages that are seen but not clicked."],
                ["Real-visitor speed", "Core Web Vitals from Chrome users, with 25-week trends."],
                ["Reliability", "Uptime, every incident, and days until SSL and domain renewals."],
              ].map(([t, b], i) => (
                <li key={t} className="group grid grid-cols-[44px_1fr] border-t border-line py-5 transition-colors duration-(--duration-fast)">
                  <span className="font-display text-title text-ink-4 italic transition-colors duration-(--duration-settle) group-hover:text-brass">{String(i + 1).padStart(2, "0")}</span>
                  <div><p className="font-semibold text-ink">{t}</p><p className="mt-1 text-small text-ink-3">{b}</p></div>
                </li>
              ))}
              <li className="border-t border-line pt-6">
                <Link href={`/r/${row.shareToken}`} className="group inline-flex items-center gap-1.5 text-body font-semibold text-accent">
                  Read the full sample report<ArrowUpRight size={15} className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </Link>
              </li>
            </ul>
            <div className="reveal relative">
              <Photo src="/images/client-reading.jpg" alt="A laptop showing bar and pie charts beside a cup of coffee" ratio="aspect-[16/11]" caption="What the client opens: a short email, the PDF, and a private link that works on a phone." sizes="(min-width: 1024px) 55vw, 100vw" />
              <div className="absolute -top-10 -left-4 hidden w-[180px] -rotate-3 overflow-hidden rounded-[4px] shadow-sheet sm:block lg:-left-12" aria-hidden>
                <div style={{ width: 794, transform: "scale(0.2267)", transformOrigin: "top left", height: 1123 * 0.2267 }}>
                  <PageStackSingle input={input} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-wash py-24 md:py-32">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Chapter index="04" kicker="A month in practice" title="One client, one October, four numbers that matter." />
            <CaseStudy facts={facts} />
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-24 sm:px-6 md:py-32">
          <Chapter index="05" kicker="Reliability" title="The details real agency tools are built on." />
          <Trust />
        </section>

        <section id="cost" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 pb-24 sm:px-6 md:pb-32">
          <Chapter index="06" kicker="Cost" title="£0 a month, up to about fifty sites.">
            Each part runs where its free tier fits best: frequent checks on Cloudflare&apos;s edge, monthly rendering on GitHub&apos;s runners, the dashboard as an ordinary web app.
          </Chapter>
          <Stack />
        </section>

        <div className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6"><FinalCta /></div>
      </main>
      <footer className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-4 border-t border-line px-4 py-8 text-small text-ink-3 sm:flex-row sm:items-center sm:px-6">
        <Logo />
        <p>Demo data is fictional · Photography CC0 via Openverse</p>
      </footer>
    </div>
  );
}

function PageStackSingle({ input }: { input: Parameters<typeof ReportDocument>[0] }) {
  return <ReportDocument {...input} only={0} />;
}
