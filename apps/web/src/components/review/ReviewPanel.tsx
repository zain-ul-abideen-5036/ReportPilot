"use client";

import { useCallback, useState } from "react";
import {
  ArrowSquareOut, CheckCircle, DownloadSimple, Info, PaperPlaneTilt, ArrowCounterClockwise, Sparkle, EnvelopeSimple, Link as LinkIcon,
} from "@phosphor-icons/react";
import type { ReportStatus } from "@reportpilot/demo";
import type { Finding } from "@reportpilot/core";
import { WorkflowStepper } from "./WorkflowStepper";
import { Toast } from "./Toast";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const SEVERITY: Record<Finding["severity"], { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-act" },
  warning: { label: "Warning", cls: "bg-watch" },
  positive: { label: "Good news", cls: "bg-good" },
  info: { label: "Note", cls: "bg-ink-4" },
};

interface Props {
  initialStatus: ReportStatus;
  findings: Finding[];
  contact: { name: string; email: string };
  narrativeSource: "template" | "ai";
  aiEnabled: boolean;
  autoSend: boolean;
  shareHref: string;
  pdfHref: string;
  version: number;
  initialNotes: string;
}

/**
 * The account manager's side of the review. In demo mode actions update
 * local state only; in production each one is a server action that writes
 * to reports and audit_log.
 */
export function ReviewPanel(props: Props) {
  const [status, setStatus] = useState<ReportStatus>(props.initialStatus === "draft" ? "in_review" : props.initialStatus);
  const [notes, setNotes] = useState(props.initialNotes);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [autoSend, setAutoSend] = useState(props.autoSend);
  const clear = useCallback(() => setToast(null), []);

  const locked = status === "approved" || status === "sent";
  const blocked = status === "collecting" || status === "failed";

  return (
    <div className="flex flex-col gap-6">
      <WorkflowStepper status={status} />

      {blocked && (
        <p className="flex gap-2 rounded-md bg-act-soft p-3 text-small text-act">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          {status === "failed"
            ? "PageSpeed collection failed after three attempts. You can approve with the speed section marked unavailable, or retry collection."
            : "Search Console has not finalised October yet. The report will be ready after the next retry."}
        </p>
      )}

      <section aria-labelledby="findings-heading">
        <h3 id="findings-heading" className="mb-2 flex items-center justify-between text-small font-semibold text-ink">
          What the report says
          <span className="font-normal text-ink-3">{props.findings.length} findings</span>
        </h3>
        <ul className="flex flex-col divide-y divide-line rounded-md hairline">
          {props.findings.slice(0, 6).map((f) => (
            <li key={f.id} className="flex items-start gap-2.5 px-3 py-2.5">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", SEVERITY[f.severity].cls)} title={SEVERITY[f.severity].label} aria-hidden />
              <span className="min-w-0 text-small leading-5 text-ink-2">
                <span className="sr-only">{SEVERITY[f.severity].label}: </span>
                {f.title}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-1.5 text-micro text-ink-3">
          <Sparkle size={12} aria-hidden />
          {props.narrativeSource === "ai"
            ? "Wording polished by AI. Every figure was checked against the source data."
            : props.aiEnabled
              ? "Written from templates. AI polishing kept the template because a figure did not match."
              : "AI wording is off for this client. Written from templates."}
        </p>
      </section>

      <section aria-labelledby="notes-heading">
        <div className="mb-2 flex items-baseline justify-between">
          <label id="notes-heading" htmlFor="notes" className="text-small font-semibold text-ink">Your note to the client</label>
          <span className="text-micro text-ink-3" aria-live="polite">{saved ? "Saved" : "Saving…"}</span>
        </div>
        <textarea
          id="notes"
          value={notes}
          disabled={locked}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          onBlur={() => setSaved(true)}
          rows={5}
          placeholder="Add context the numbers can't give: what you worked on, what's planned next."
          className="w-full resize-y rounded-md bg-raised p-3 text-body leading-6 text-ink hairline placeholder:text-ink-4 transition-shadow duration-(--duration-fast) focus:shadow-[inset_0_0_0_1.5px_var(--accent)] focus:outline-none disabled:bg-sunken disabled:text-ink-3"
        />
        <p className="mt-1 text-micro text-ink-3">Appears on the recommendations page, signed with your name.</p>
      </section>

      <section className="rounded-md bg-sunken/60 p-3">
        <p className="flex items-center gap-2 text-small text-ink-2">
          <EnvelopeSimple size={15} className="text-ink-3" aria-hidden />
          Sends to <span className="font-medium text-ink">{props.contact.name}</span>
        </p>
        <p className="mt-0.5 pl-[23px] text-micro text-ink-3">{props.contact.email} · PDF attached, plus a web link valid for 90 days</p>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 pl-[23px] text-small text-ink-2">
          Send automatically next month
          <button
            type="button"
            role="switch"
            aria-checked={autoSend}
            onClick={() => setAutoSend((v) => !v)}
            className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-(--duration-fast)", autoSend ? "bg-accent" : "bg-line-strong")}
          >
            <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-raised shadow-sm transition-transform duration-(--duration-fast) ease-(--ease-standard)", autoSend && "translate-x-4")} />
          </button>
        </label>
      </section>

      <div className="flex flex-col gap-2">
        {status === "in_review" && (
          <Button variant="primary" className="w-full" onClick={() => { setStatus("approved"); setToast("Report approved. It will send at 09:00 tomorrow."); }}>
            <CheckCircle size={16} weight="bold" aria-hidden />Approve report
          </Button>
        )}
        {status === "failed" && (
          <Button variant="primary" className="w-full" onClick={() => { setStatus("in_review"); setToast("Approved without the speed section."); }}>
            <CheckCircle size={16} weight="bold" aria-hidden />Approve without speed data
          </Button>
        )}
        {status === "approved" && (
          <>
            <Button variant="primary" className="w-full" onClick={() => { setStatus("sent"); setToast(`Sent to ${props.contact.name}.`); }}>
              <PaperPlaneTilt size={16} weight="bold" aria-hidden />Send now
            </Button>
            <Button variant="quiet" className="w-full" onClick={() => { setStatus("in_review"); setToast("Approval withdrawn. The report is back in review."); }}>
              <ArrowCounterClockwise size={15} aria-hidden />Withdraw approval
            </Button>
          </>
        )}
        {status === "sent" && (
          <p className="flex items-center justify-center gap-2 rounded-md bg-good-soft py-2 text-small font-medium text-good">
            <PaperPlaneTilt size={15} weight="fill" aria-hidden />Delivered to {props.contact.name}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a href={props.pdfHref} className={buttonClass({ variant: "secondary", size: "sm" })}>
            <DownloadSimple size={14} aria-hidden />PDF
          </a>
          <a href={props.shareHref} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
            <LinkIcon size={14} aria-hidden />Web version<ArrowSquareOut size={12} className="text-ink-4" aria-hidden />
          </a>
        </div>
      </div>

      <p className="border-t border-line pt-4 text-micro text-ink-3">
        Version {props.version} · every change is recorded in the audit log.
      </p>
      <Toast message={toast} onDone={clear} />
    </div>
  );
}
