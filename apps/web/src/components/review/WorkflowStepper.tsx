import { Check } from "@phosphor-icons/react";
import type { ReportStatus } from "@reportpilot/demo";
import { cn } from "@/lib/cn";

const STEPS: Array<{ key: ReportStatus; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
];

/** Draft → In review → Approved → Sent. Completed steps get a tick, the current one a ring. */
export function WorkflowStepper({ status }: { status: ReportStatus }) {
  const index = status === "collecting" || status === "failed" ? -1 : STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center" aria-label="Approval workflow">
      {STEPS.map((step, i) => {
        const done = i < index || status === "sent";
        const current = i === index && status !== "sent";
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-micro font-semibold transition-colors duration-(--duration-settle)",
                  done && "bg-accent text-accent-ink",
                  current && "bg-raised text-accent shadow-[inset_0_0_0_2px_var(--accent)]",
                  !done && !current && "bg-sunken text-ink-4",
                )}
              >
                {done ? <Check size={12} weight="bold" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-micro whitespace-nowrap", current ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink-4")}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="relative mx-1.5 mb-5 h-px flex-1 bg-line" aria-hidden>
                <span className={cn("absolute inset-0 origin-left bg-accent transition-transform duration-(--duration-settle) ease-(--ease-standard)", done || i < index ? "scale-x-100" : "scale-x-0")} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
