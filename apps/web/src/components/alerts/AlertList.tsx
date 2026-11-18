"use client";

import { useState } from "react";
import {
  Certificate, ChartLineDown, Globe, Gauge, PlugsConnected, MagnifyingGlass, Check, CheckCircle, Eye,
} from "@phosphor-icons/react";
import type { AlertKind, AlertState } from "@reportpilot/demo";
import { cn } from "@/lib/cn";

export interface AlertView {
  id: string;
  kind: AlertKind;
  severity: "critical" | "warning";
  state: AlertState;
  title: string;
  detail: string;
  client: string;
  initials: string;
  raised: string;
  resolvedIn: string | null;
}

const ICON: Record<AlertKind, typeof Globe> = {
  downtime: PlugsConnected,
  ssl: Certificate,
  domain: Globe,
  traffic: ChartLineDown,
  vitals: Gauge,
  indexing: MagnifyingGlass,
};

const STATE_LABEL: Record<AlertState, string> = { open: "Open", acknowledged: "Acknowledged", resolved: "Resolved" };

/**
 * Alerts raised between reports. Acknowledge says "someone has this";
 * resolve closes it. Both are recorded in the audit log in production.
 */
export function AlertList({ initial }: { initial: AlertView[] }) {
  const [alerts, setAlerts] = useState(initial);
  const [filter, setFilter] = useState<AlertState | "all">("all");
  const update = (id: string, state: AlertState) => setAlerts((xs) => xs.map((a) => (a.id === id ? { ...a, state } : a)));
  const visible = alerts.filter((a) => filter === "all" || a.state === filter);
  const count = (s: AlertState) => alerts.filter((a) => a.state === s).length;

  return (
    <>
      <div role="radiogroup" aria-label="Filter alerts" className="mb-6 inline-flex rounded-md bg-sunken p-1">
        {(["all", "open", "acknowledged", "resolved"] as const).map((f) => (
          <button
            key={f}
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={cn("press h-7 rounded-[6px] px-3 text-small", filter === f ? "bg-raised font-medium text-ink shadow-raised" : "text-ink-3 hover:text-ink")}
          >
            {f === "all" ? "All" : STATE_LABEL[f]}
            {f !== "all" && <span className="ml-1.5 tnum text-ink-4">{count(f)}</span>}
          </button>
        ))}
      </div>

      <ul className="stagger flex flex-col gap-2">
        {visible.map((a) => {
          const Icon = ICON[a.kind];
          const resolved = a.state === "resolved";
          return (
            <li key={a.id} id={a.id} className={cn("scroll-mt-20 rounded-lg bg-raised p-4 shadow-raised transition-opacity duration-(--duration-settle) sm:p-5", resolved && "opacity-60")}>
              <div className="flex gap-4">
                <span className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  resolved ? "bg-sunken text-ink-3" : a.severity === "critical" ? "bg-act-soft text-act" : "bg-watch-soft text-watch",
                )}>
                  <Icon size={18} weight="duotone" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="font-medium text-ink">{a.title}</p>
                    <span className="text-small text-ink-3">{a.client}</span>
                  </div>
                  <p className="mt-1 max-w-[70ch] text-small text-ink-2">{a.detail}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-ink-3">
                    <span className={cn("font-semibold uppercase tracking-wide", a.severity === "critical" ? "text-act" : "text-watch", resolved && "text-ink-3")}>{a.severity}</span>
                    <span>Raised {a.raised}</span>
                    {a.resolvedIn && <span>Recovered in {a.resolvedIn}</span>}
                    <span className="flex items-center gap-1">
                      {a.state === "acknowledged" && <Eye size={11} aria-hidden />}
                      {a.state === "resolved" && <CheckCircle size={11} aria-hidden />}
                      {STATE_LABEL[a.state]}
                    </span>
                  </p>
                </div>
                <div className="hidden shrink-0 items-start gap-2 sm:flex">
                  {a.state === "open" && (
                    <button onClick={() => update(a.id, "acknowledged")} className="press h-8 rounded-md bg-raised px-3 text-small font-medium text-ink-2 hairline hover:text-ink">
                      Acknowledge
                    </button>
                  )}
                  {a.state !== "resolved" && (
                    <button onClick={() => update(a.id, "resolved")} className="press flex h-8 items-center gap-1.5 rounded-md px-3 text-small font-medium text-ink-3 hover:bg-sunken hover:text-ink">
                      <Check size={13} weight="bold" aria-hidden />Resolve
                    </button>
                  )}
                </div>
              </div>
              {a.state !== "resolved" && (
                <div className="mt-3 flex gap-2 pl-13 sm:hidden">
                  {a.state === "open" && <button onClick={() => update(a.id, "acknowledged")} className="press h-8 flex-1 rounded-md px-3 text-small font-medium text-ink-2 hairline">Acknowledge</button>}
                  <button onClick={() => update(a.id, "resolved")} className="press h-8 flex-1 rounded-md bg-sunken px-3 text-small font-medium text-ink-2">Resolve</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && <p className="py-10 text-center text-small text-ink-3">Nothing here. Alerts appear when a check fails twice in a row or a threshold is crossed.</p>}
    </>
  );
}
