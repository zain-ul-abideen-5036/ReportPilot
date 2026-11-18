const ITEMS = [
  "Google Search Console",
  "PageSpeed Insights",
  "Chrome UX Report",
  "Uptime every five minutes",
  "SSL and domain expiry",
  "Striking-distance keywords",
  "Core Web Vitals",
  "Branded A4 PDF",
  "Private client links",
  "Approval before sending",
];

/** What goes into every report, scrolling slowly. Paused under reduced motion. */
export function Marquee() {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {ITEMS.map((t) => (
        <li key={t} className="flex items-center gap-10 whitespace-nowrap font-display text-[1.375rem] text-ink-3 italic">
          {t}
          <span className="size-1.5 rounded-full bg-brass/70" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="In every report" className="marquee-mask overflow-hidden border-y border-line py-6">
      <div className="marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
