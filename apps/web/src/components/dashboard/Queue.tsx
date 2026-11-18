import Link from "next/link";
import { ArrowRight, Bell } from "@phosphor-icons/react/dist/ssr";
import type { SiteRow } from "@/lib/data";
import { Monogram } from "@/components/ui/Monogram";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { timeAgo } from "@/lib/time";
import type { DemoAlert } from "@reportpilot/demo";

export type QueueItem =
  | { kind: "report"; row: SiteRow }
  | { kind: "alert"; alert: DemoAlert; row: SiteRow };

/**
 * Everything waiting on the signed-in person, newest pressure first.
 * A rule-separated list, not a grid of cards: it is read top to bottom.
 */
export function Queue({ items }: { items: QueueItem[] }) {
  return (
    <ul className="stagger divide-y divide-line">
      {items.map((item) => {
        const { row } = item;
        const href = item.kind === "report" ? `/reports/${row.site.id}` : `/alerts#${item.alert.id}`;
        const headline = item.kind === "report" ? row.report.findings[0]?.title : item.alert.title;
        return (
          <li key={item.kind === "report" ? row.site.id : item.alert.id}>
            <Link href={href} className="group -mx-3 flex items-center gap-4 rounded-md px-3 py-3.5 transition-colors duration-(--duration-fast) hover:bg-sunken/70">
              <Monogram name={row.client.name} initials={row.client.initials} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-medium text-ink">{row.client.name}</span>
                  {item.kind === "report" ? (
                    <StatusBadge status={row.status} />
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-xs bg-act-soft px-1.5 py-0.5 text-small font-medium text-act">
                      <Bell size={12} weight="fill" aria-hidden />
                      Alert
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-small text-ink-3">
                  {headline}
                  {item.kind === "alert" && <span className="text-ink-4"> · {timeAgo(item.alert.raisedAt)}</span>}
                </p>
              </div>
              <span className="hidden items-center gap-1 text-small font-medium text-ink-3 transition-colors group-hover:text-accent sm:flex">
                {item.kind === "report" ? "Review" : "Open"}
                <ArrowRight size={14} className="transition-transform duration-(--duration-fast) ease-(--ease-standard) group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
