import { Robot } from "@phosphor-icons/react/dist/ssr";
import type { AuditRow } from "@/lib/data";
import { timeAgo } from "@/lib/time";

/** The audit log, as people read it: who did what, to which client, when. */
export function ActivityFeed({ entries }: { entries: AuditRow[] }) {
  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-line">
      {entries.map((e) => (
        <li key={e.id} className="relative flex gap-3">
          {e.user ? (
            <span className="relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full bg-raised text-[9px] font-semibold text-ink-2 hairline">
              {e.user.initials}
            </span>
          ) : (
            <span className="relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Robot size={12} weight="bold" aria-hidden />
            </span>
          )}
          <p className="min-w-0 text-small leading-5 text-ink-2">
            <span className="font-medium text-ink">{e.user?.name.split(" ")[0] ?? "ReportPilot"}</span> {e.action}
            {e.target && <>{" "}for <span className="text-ink">{e.target}</span></>}
            <span className="block text-micro text-ink-4">{timeAgo(e.at)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
