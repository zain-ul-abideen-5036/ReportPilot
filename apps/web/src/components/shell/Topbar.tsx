import Link from "next/link";
import { CalendarBlank, CaretRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { formatPeriod } from "@reportpilot/core";

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumbs, the reporting month and search. Sits above every page. */
export function Topbar({ crumbs, period }: { crumbs: Crumb[]; period: string }) {
  return (
    <div className="flex h-14 items-center justify-between gap-4 border-b border-line">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-small text-ink-3">
          {crumbs.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <CaretRight size={11} className="shrink-0 text-ink-4" aria-hidden />}
              {c.href ? (
                <Link href={c.href} className="truncate hover:text-ink">{c.label}</Link>
              ) : (
                <span className="truncate font-medium text-ink" aria-current="page">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-small text-ink-2 hairline sm:inline-flex">
          <CalendarBlank size={14} className="text-ink-3" aria-hidden />
          {formatPeriod(period)} cycle
        </span>
        <label className="group hidden h-8 w-56 items-center gap-2 rounded-md bg-raised px-2.5 text-small text-ink-3 hairline transition-shadow duration-[--duration-fast] focus-within:shadow-[inset_0_0_0_1px_var(--accent)] md:flex">
          <MagnifyingGlass size={14} aria-hidden />
          <input
            type="search"
            placeholder="Search clients and reports"
            className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-4 focus:outline-none"
          />
          <kbd className="rounded-xs px-1 font-mono text-[10px] text-ink-4 hairline">/</kbd>
        </label>
      </div>
    </div>
  );
}
