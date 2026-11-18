import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock, Coffee } from "@phosphor-icons/react/dist/ssr";
import { CountUp } from "./CountUp";
import { Photo } from "./Photo";

/* Shared heading for numbered landing chapters. */
export function Chapter({ index, kicker, title, children }: { index: string; kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="reveal grid gap-6 pt-6 md:grid-cols-[180px_minmax(0,1fr)] md:gap-10">
      <div className="md:col-span-2"><div className="rule-gradient h-px w-full opacity-80" /></div>
      <p className="flex items-baseline gap-3 text-small text-ink-3">
        <span className="font-display text-title text-brass italic">{index}</span>
        {kicker}
      </p>
      <div>
        <h2 className="max-w-[20ch] font-display text-[2.25rem] leading-[1.04] tracking-[-0.028em] text-ink sm:text-[3.25rem]">{title}</h2>
        {children && <div className="mt-5 max-w-[58ch] text-lead text-ink-2">{children}</div>}
      </div>
    </div>
  );
}

export function Figures() {
  const figures: Array<{ to: number; prefix?: string; suffix: string; label: string; strike?: boolean }> = [
    { to: 3, suffix: " h", label: "a typical agency spends on each client's monthly report", strike: true },
    { to: 10, suffix: " min", label: "to review and approve the same report in ReportPilot" },
    { to: 0, prefix: "£", suffix: "", label: "a month to run for a portfolio or a small agency, on free tiers" },
    { to: 288, suffix: "", label: "uptime checks a day for every site, with alerts between reports" },
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4">
      {figures.map((f, i) => (
        <div key={f.label} className={`reveal px-1 py-9 sm:px-7 ${i % 2 ? "border-l border-line" : ""} ${i === 2 ? "lg:border-l" : ""} ${i > 1 ? "border-t border-line lg:border-t-0" : ""}`}>
          <dt className={`font-display text-[3.25rem] leading-none tracking-[-0.035em] tnum sm:text-[4.5rem] ${f.strike ? "text-ink-4 line-through decoration-copper/60 decoration-2" : "text-gradient"}`}>
            <CountUp to={f.to} prefix={f.prefix} suffix={f.suffix} />
          </dt>
          <dd className="mt-3 max-w-[26ch] text-small text-ink-3">{f.label}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The problem and the outcome as two photographs side by side. Offset
 * vertically on desktop so the spread reads as an editorial layout rather
 * than two equal tiles.
 */
export function BeforeAfter() {
  return (
    <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-14">
      <div className="reveal">
        <Photo src="/images/before-the-report.jpg" alt="A man at a laptop with his hand on his forehead, frustrated" ratio="aspect-[4/3]" index="Before" caption="The first week of every month: exports, screenshots, a slide deck and an email, for every client, by hand." />
        <ul className="mt-6 flex flex-col gap-2.5 text-body text-ink-2">
          {["Copy figures out of four different tools", "Paste charts into slides, fix the formatting", "Write the commentary from scratch", "Email it, then repeat for the next client"].map((t) => (
            <li key={t} className="flex gap-3"><Clock size={16} className="mt-0.5 shrink-0 text-ink-4" aria-hidden />{t}</li>
          ))}
        </ul>
      </div>
      <div className="reveal md:mt-24">
        <Photo src="/images/after-the-report.jpg" alt="A man smiling at his desk, holding a folder" ratio="aspect-[4/3]" index="After" caption="On the 3rd, the drafts are already waiting. Read, add a line, approve. Ten minutes a client." />
        <ul className="mt-6 flex flex-col gap-2.5 text-body text-ink-2">
          {["Figures collected and checked overnight", "Charts and pages already in your brand", "A plain-English summary to start from", "One click to approve, or auto-send"].map((t) => (
            <li key={t} className="flex gap-3"><Coffee size={16} className="mt-0.5 shrink-0 text-brass" aria-hidden />{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A real month from the demo data, told as a short case. */
export function CaseStudy({ facts }: { facts: Array<{ value: string; label: string }> }) {
  return (
    <div className="mt-14 grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
      <Photo className="reveal" src="/images/dental-practice.jpg" alt="An empty treatment room in a modern dental practice" ratio="aspect-[5/4]" index="Demo client" caption="Harlow & Finch Dental, Leeds. A fictional practice whose October report ships with the demo." sizes="(min-width: 1024px) 50vw, 100vw" />
      <div className="reveal">
        <p className="font-display text-[1.75rem] leading-[1.25] tracking-[-0.015em] text-ink sm:text-[2rem]">
          &ldquo;What changed this month, and what should we do next?&rdquo;
        </p>
        <p className="mt-3 text-body text-ink-3">The one question every client report has to answer. Here is how October answered it for the practice:</p>
        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-7">
          {facts.map((f) => (
            <div key={f.label} className="border-t border-line pt-4">
              <dt className="font-display text-[2.25rem] leading-none tracking-[-0.03em] text-ink tnum">{f.value}</dt>
              <dd className="mt-2 text-small text-ink-3">{f.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

const TRUST = [
  ["Nothing sends without approval", "Draft, in review, approved, sent. Every change is versioned and written to an audit log."],
  ["Jobs that can safely re-run", "Each report is keyed on site and month. Running the pipeline twice never sends twice."],
  ["A number check on AI text", "If the AI's wording contains a figure that isn't in the data, its text is thrown away and the template is used."],
  ["Honest about missing data", "If PageSpeed is down, the speed page says so. It never shows zeros or fails the whole report."],
  ["Read-only Google access", "A service account added as a Restricted user. No OAuth verification, and clients can revoke it any time."],
  ["Heartbeat monitoring", "The monthly job pings a heartbeat at start and finish. If it doesn't run, someone gets an email."],
];

export function Trust() {
  return (
    <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
      <Photo className="reveal lg:sticky lg:top-24 lg:self-start" src="/images/agency-review.jpg" alt="Three people around a table with laptops, notebooks and coffee" ratio="aspect-[4/3]" caption="Built for the people who sign their name under the report." />
      <dl className="grid">
        {TRUST.map(([t, b], i) => (
          <div key={t} className="reveal grid grid-cols-[44px_1fr] gap-x-3 border-t border-line py-7 first:border-t-0 first:pt-0">
            <span className="font-display text-title text-ink-4 italic">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <dt className="text-lead font-semibold text-ink">{t}</dt>
              <dd className="mt-1.5 max-w-[52ch] text-body text-ink-3">{b}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

const STACK = [
  ["Dashboard", "Next.js on Cloudflare or Vercel", "Free"],
  ["Database", "Postgres on Neon or Supabase", "0.5 GB"],
  ["Uptime", "Cloudflare Workers cron", "100k requests a day"],
  ["Monthly jobs", "GitHub Actions + Playwright", "2,000 min a month"],
  ["Files", "Cloudflare R2", "10 GB, no egress fees"],
  ["Email", "Resend", "3,000 a month"],
];

export function Stack() {
  return (
    <div className="reveal mt-14 overflow-hidden rounded-[10px] bg-raised shadow-raised">
      <table className="w-full text-left text-body">
        <caption className="sr-only">Free-tier services ReportPilot runs on</caption>
        <tbody className="divide-y divide-line">
          {STACK.map(([layer, choice, limit]) => (
            <tr key={layer} className="transition-colors duration-(--duration-fast) hover:bg-surface">
              <th scope="row" className="w-1/4 py-4 pr-4 pl-5 font-semibold text-ink sm:pl-8">{layer}</th>
              <td className="py-4 pr-4 text-ink-2">{choice}</td>
              <td className="py-4 pr-5 text-right text-small text-ink-3 tnum sm:pr-8">{limit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinalCta() {
  return (
    <section className="reveal relative isolate overflow-hidden rounded-[14px] bg-brand px-6 py-16 text-accent-ink sm:px-14 sm:py-24">
      <div aria-hidden className="absolute -top-32 -right-24 -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(232_190_130/0.45),transparent)] motion-safe:animate-[drift_18s_ease-in-out_infinite_alternate]" />
      <div aria-hidden className="absolute -bottom-40 -left-20 -z-10 size-[460px] rounded-full bg-[radial-gradient(closest-side,rgb(150_200_170/0.3),transparent)]" />
      <p className="text-small text-accent-ink/70">Ready when the 3rd comes round</p>
      <h2 className="mt-4 max-w-[16ch] font-display text-[2.5rem] leading-[1.02] tracking-[-0.03em] sm:text-[4.5rem]">
        Spend the first week of the month on <em className="text-[#f0d3a4]">the work</em>, not the report.
      </h2>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/dashboard" className="press group inline-flex h-12 items-center gap-2 rounded-full bg-paper px-6 text-body font-semibold text-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.5)] hover:bg-raised">
          Open the demo dashboard<ArrowRight size={16} className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <a href="https://github.com/zain-ul-abideen-5036/ReportPilot" className="press inline-flex h-12 items-center gap-2 rounded-full px-6 text-body font-medium text-accent-ink/85 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)] hover:text-accent-ink">
          Source on GitHub<ArrowUpRight size={15} aria-hidden />
        </a>
      </div>
    </section>
  );
}
