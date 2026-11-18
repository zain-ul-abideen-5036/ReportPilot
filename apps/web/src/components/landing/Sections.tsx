import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

/* Shared heading for numbered landing sections. */
export function Chapter({ index, kicker, title, children }: { index: string; kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="reveal grid gap-6 border-t border-ink pt-6 md:grid-cols-[180px_minmax(0,1fr)] md:gap-10">
      <p className="flex items-baseline gap-3 text-small text-ink-3">
        <span className="font-display text-title text-accent italic">{index}</span>
        {kicker}
      </p>
      <div>
        <h2 className="max-w-[20ch] font-display text-[2.25rem] leading-[1.05] tracking-[-0.025em] text-ink sm:text-[3rem]">{title}</h2>
        {children && <div className="mt-5 max-w-[58ch] text-lead text-ink-2">{children}</div>}
      </div>
    </div>
  );
}

export function Figures() {
  const figures = [
    { value: "3 h", label: "a typical agency spends on each client's monthly report", strike: true },
    { value: "10 min", label: "to review and approve the same report in ReportPilot" },
    { value: "£0", label: "a month to run for a portfolio or a small agency, on free tiers" },
    { value: "5 min", label: "between uptime checks, with alerts between reports" },
  ];
  return (
    <dl className="grid grid-cols-2 border-y border-line lg:grid-cols-4">
      {figures.map((f, i) => (
        <div key={f.value} className={`reveal px-1 py-8 sm:px-6 ${i % 2 ? "border-l border-line" : ""} ${i === 2 ? "lg:border-l" : ""} ${i > 1 ? "border-t border-line lg:border-t-0" : ""}`}>
          <dt className={`font-display text-[3rem] leading-none tracking-[-0.03em] tnum sm:text-[4rem] ${f.strike ? "text-ink-4 line-through decoration-act/60 decoration-2" : "text-ink"}`}>{f.value}</dt>
          <dd className="mt-3 max-w-[26ch] text-small text-ink-3">{f.label}</dd>
        </div>
      ))}
    </dl>
  );
}

const STEPS = [
  { n: "01", title: "Collect", body: "Search Console, PageSpeed, the Chrome UX Report and uptime, each independent. One failing never blocks the others." },
  { n: "02", title: "Calculate", body: "Month-on-month, year-on-year, striking-distance keywords, low-CTR pages. Pure functions with unit tests." },
  { n: "03", title: "Write", body: "A rules engine ranks what matters. Templates phrase it; AI may polish it, but only if every number survives a check." },
  { n: "04", title: "Render", body: "Branded HTML printed to a tagged, accessible A4 PDF by a real Chromium." },
  { n: "05", title: "Review", body: "The draft lands in the dashboard. Add a note, approve, or turn on auto-send per client." },
  { n: "06", title: "Send", body: "Email with the PDF and a private web link. Bounces flag the contact; every step is logged." },
];

export function Steps() {
  return (
    <ol className="mt-14 grid gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((s) => (
        <li key={s.n} className="reveal group flex flex-col bg-paper p-6 transition-colors duration-(--duration-settle) hover:bg-surface sm:p-8">
          <span className="font-display text-[2.75rem] leading-none text-ink-4 italic transition-colors duration-(--duration-settle) group-hover:text-accent">{s.n}</span>
          <h3 className="mt-8 text-lead font-semibold text-ink">{s.title}</h3>
          <p className="mt-2 text-body text-ink-3">{s.body}</p>
        </li>
      ))}
    </ol>
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
    <dl className="mt-14 grid gap-x-12 md:grid-cols-2">
      {TRUST.map(([t, b]) => (
        <div key={t} className="reveal grid grid-cols-[28px_1fr] gap-x-3 border-t border-line py-6">
          <span className="mt-1 size-2 rounded-full bg-accent" aria-hidden />
          <div>
            <dt className="text-lead font-medium text-ink">{t}</dt>
            <dd className="mt-1.5 text-body text-ink-3">{b}</dd>
          </div>
        </div>
      ))}
    </dl>
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
    <div className="reveal mt-14 overflow-hidden rounded-lg bg-raised shadow-raised">
      <table className="w-full text-left text-body">
        <caption className="sr-only">Free-tier services ReportPilot runs on</caption>
        <tbody className="divide-y divide-line">
          {STACK.map(([layer, choice, limit]) => (
            <tr key={layer}>
              <th scope="row" className="w-1/4 py-4 pr-4 pl-5 font-medium text-ink sm:pl-8">{layer}</th>
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
    <section className="reveal relative overflow-hidden rounded-lg bg-ink px-6 py-16 text-paper sm:px-12 sm:py-24">
      <p className="text-small text-paper/60">Ready when the 3rd comes round</p>
      <h2 className="mt-4 max-w-[16ch] font-display text-[2.5rem] leading-[1.02] tracking-[-0.03em] sm:text-[4.25rem]">
        Spend the first week of the month on <em className="text-[color:var(--accent-soft)]">the work</em>, not the report.
      </h2>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/dashboard" className="press group inline-flex h-11 items-center gap-2 rounded-full bg-paper px-5 text-body font-medium text-ink hover:bg-surface">
          Open the demo dashboard<ArrowRight size={16} className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <a href="https://github.com/zain-ul-abideen-5036/ReportPilot" className="press inline-flex h-11 items-center gap-2 rounded-full px-5 text-body font-medium text-paper/80 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)] hover:text-paper">
          Source on GitHub<ArrowUpRight size={15} aria-hidden />
        </a>
      </div>
      <svg className="pointer-events-none absolute -right-16 -bottom-20 w-[420px] text-paper/[0.06]" viewBox="0 0 200 200" aria-hidden>
        <path d="M20 170 L70 110 L105 135 L180 40" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </section>
  );
}
