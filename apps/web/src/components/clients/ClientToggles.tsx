"use client";

import { useState, useTransition } from "react";
import { Lightning, Sparkle } from "@phosphor-icons/react";
import { setClientFlag } from "@/lib/actions";
import { cn } from "@/lib/cn";

/** Auto-send and AI wording for one client. Saved immediately; viewers see them disabled. */
export function ClientToggles({ clientId, autoSend, aiEnabled, canEdit }: { clientId: string; autoSend: boolean; aiEnabled: boolean; canEdit: boolean }) {
  const [values, setValues] = useState({ autoSend, aiEnabled });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (flag: "autoSend" | "aiEnabled") => {
    const on = !values[flag];
    setValues((v) => ({ ...v, [flag]: on }));
    setError(null);
    start(async () => {
      const r = await setClientFlag({ clientId, flag, on });
      if (!r.ok) {
        setValues((v) => ({ ...v, [flag]: !on }));
        setError(r.error);
      }
    });
  };
  const rows = [
    { flag: "autoSend" as const, icon: Lightning, label: "Send automatically", hint: "Skips review; the report goes out on its day." },
    { flag: "aiEnabled" as const, icon: Sparkle, label: "AI wording", hint: "Aggregates only, discarded if a figure does not match." },
  ];
  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ flag, icon: Icon, label, hint }) => (
        <div key={flag} className="flex items-start gap-2">
          <Icon size={14} className="mt-0.5 text-ink-3" aria-hidden />
          <span className="min-w-0 flex-1">
            <span id={`${flag}-label`} className="block text-small text-ink-2">{label}</span>
            <span className="block text-micro text-ink-4">{hint}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={values[flag]}
            aria-labelledby={`${flag}-label`}
            disabled={!canEdit || pending}
            onClick={() => toggle(flag)}
            className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-(--duration-fast) disabled:opacity-50", values[flag] ? "bg-accent" : "bg-line-strong")}
          >
            <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-raised shadow-sm transition-transform duration-(--duration-fast) ease-(--ease-standard)", values[flag] && "translate-x-4")} />
          </button>
        </div>
      ))}
      {error && <p role="alert" className="text-micro text-act">{error}</p>}
    </div>
  );
}
