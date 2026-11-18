import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LandingNav } from "@/components/landing/LandingNav";
import { PageStack } from "@/components/landing/PageStack";
import { Chapter, Figures, FinalCta, Stack, Steps, Trust } from "@/components/landing/Sections";
import { Logo } from "@/components/shell/Logo";
import { getSite, now, org, shareToken } from "@/lib/data";

export default function Landing() {
  const row = getSite("site_harlow")!;
  const input = {
    report: row.report,
    narrative: row.narrative,
    org: { name: org.name, primary: org.primary, accent: org.accent, footer: org.footer, initials: "NF" },
    client: { name: row.client.name },
    preparedBy: row.manager.name,
    generatedAt: now.toISOString(),
  };
  return (
    <div className="grain min-h-dvh">
      <LandingNav />
      <main>
        <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pt-14 pb-20 sm:px-6 md:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pb-28">
          <div className="animate-enter">
            <p className="inline-flex items-center gap-2 rounded-full bg-raised px-3 py-1 text-small text-ink-2 shadow-raised">
              <span className="size-1.5 rounded-full bg-good" aria-hidden />
              For web agencies with monthly retainers
            </p>
            <h1 className="mt-7 font-display text-[3.25rem] leading-[0.98] font-normal tracking-[-0.035em] text-ink sm:text-[4.5rem] lg:text-[5.25rem]">
              The monthly report, <em className="text-accent">written</em> before you start work.
            </h1>
            <p className="mt-7 max-w-[46ch] text-lead text-ink-2 sm:text-[1.125rem] sm:leading-[1.65]">
              Every client gets a branded PDF on search, speed and uptime, with a plain-English summary of what changed and what to do next.
              ReportPilot drafts it on the 3rd; you read it, add a line, and approve.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="press group inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-body font-medium text-accent-ink shadow-[0_1px_2px_rgb(0_0_0/0.15)] hover:bg-accent-hover">
                Open the demo<ArrowRight size={16} className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link href={`/r/${shareToken(row.site.id)}`} className="press inline-flex h-11 items-center rounded-full px-5 text-body font-medium text-ink-2 hairline hover:bg-raised hover:text-ink">
                Read a sample report
              </Link>
            </div>
            <p className="mt-6 text-small text-ink-3">Free to run. No accounts for your clients. Demo data, no sign-up.</p>
          </div>
          <div className="relative mx-auto hidden justify-center sm:flex lg:justify-end">
            <PageStack input={input} />
          </div>
        </section>

        <div className="mx-auto max-w-[1240px] px-4 sm:px-6"><Figures /></div>

        <section id="how" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-24 sm:px-6 md:py-32">
          <Chapter index="01" kicker="How it works" title="Six stages, all of them unattended.">
            On the 3rd of each month, once Google marks the previous month final, a scheduled job works through every active site. Each stage saves its result, so a failure resumes where it stopped.
          </Chapter>
          <Steps />
        </section>

        <section id="report" className="bg-surface py-24 md:py-32">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Chapter index="02" kicker="The report" title="Eight pages a business owner will actually read.">
              Status lights and five highlights on the first page. Search, opportunities, speed and uptime after it. Every figure is calculated the same way every month, and an appendix says exactly how.
            </Chapter>
            <div className="mt-14 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
              <ul className="reveal flex flex-col">
                {[
                  ["Executive summary", "Three status lights and the month's highlights in plain English."],
                  ["Opportunities", "Keywords one push from page one, and pages that are seen but not clicked."],
                  ["Real-visitor speed", "Core Web Vitals from Chrome users, with 25-week trends."],
                  ["Reliability", "Uptime, every incident, and days until SSL and domain renewals."],
                ].map(([t, b], i) => (
                  <li key={t} className="grid grid-cols-[40px_1fr] border-t border-line py-5">
                    <span className="font-display text-title text-ink-4 italic">{String(i + 1).padStart(2, "0")}</span>
                    <div><p className="font-medium text-ink">{t}</p><p className="mt-1 text-small text-ink-3">{b}</p></div>
                  </li>
                ))}
              </ul>
              <div className="reveal flex justify-center overflow-hidden">
                <PageStack input={input} scale={0.4} />
              </div>
            </div>
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-24 sm:px-6 md:py-32">
          <Chapter index="03" kicker="Reliability" title="The details real agency tools are built on." />
          <Trust />
        </section>

        <section id="cost" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 pb-24 sm:px-6 md:pb-32">
          <Chapter index="04" kicker="Cost" title="£0 a month, up to about fifty sites.">
            Each part runs where its free tier fits best: frequent checks on Cloudflare&apos;s edge, monthly rendering on GitHub&apos;s runners, the dashboard as an ordinary web app.
          </Chapter>
          <Stack />
        </section>

        <div className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6"><FinalCta /></div>
      </main>
      <footer className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-4 border-t border-line px-4 py-8 text-small text-ink-3 sm:flex-row sm:items-center sm:px-6">
        <Logo />
        <p>Built by Zain Ul Abideen · MIT licence · Demo data is fictional</p>
      </footer>
    </div>
  );
}
