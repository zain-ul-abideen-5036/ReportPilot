"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowSquareOut, CheckCircle, DownloadSimple, Info, PaperPlaneTilt, ArrowCounterClockwise, Sparkle, EnvelopeSimple, Link as LinkIcon,
  LinkBreak, ArrowsClockwise, Eye,
} from "@phosphor-icons/react";
import type { Finding, ReportStatus } from "@reportpilot/core";
import { WorkflowStepper } from "./WorkflowStepper";
import { Toast } from "./Toast";
import { Button, buttonClass } from "@/components/ui/Button";
import { reissueLink, reviewReport, revokeLink, saveNotes, sendNow, setClientFlag, type ActionResult } from "@/lib/actions";
import { cn } from "@/lib/cn";

const SEVERITY: Record<Finding["severity"], { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-act" },
  warning: { label: "Warning", cls: "bg-watch" },
  positive: { label: "Good news", cls: "bg-good" },
  info: { label: "Note", cls: "bg-ink-4" },
};

const DELIVERY: Record<string, string> = {
  queued: "Handed to the mail service",
  delivered: "Delivered",
  bounced: "Bounced. The contact is flagged on the client page",
  complained: "Marked as spam by the recipient",
};

interface Props {
  siteId: string;
  clientId: string;
  status: ReportStatus;
  findings: Finding[];
  contact: { name: string; email: string };
  narrativeSource: "template" | "ai";
  aiEnabled: boolean;
  autoSend: boolean;
  shareHref: string | null;
  pdfHref: string;
  version: number;
  notes: string;
  canEdit: boolean;
  demo: boolean;
  deliveryStatus: string | null;
  failureNote: string | null;
}

/**
 * The account manager's side of the review. Every button is a server
 * action: it is validated, checked against the workflow and the user's
 * role, saved, and written to the audit log. The panel shows the result
 * the server returns, never an assumed one.
 */
export function ReviewPanel(props: Props) {
  const [status, setStatus] = useState<ReportStatus>(props.status);
  const [notes, setNotes] = useState(props.notes);
  const [saved, setSaved] = useState<"saved" | "dirty" | "saving">("saved");
  const [autoSend, setAutoSend] = useState(props.autoSend);
  const [shareHref, setShareHref] = useState(props.shareHref);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lastSaved = useRef(props.notes);
  const clear = useCallback(() => setToast(null), []);

  // After a save the server re-renders the page; keep the panel in step with what it says.
  useEffect(() => setStatus(props.status), [props.status]);
  useEffect(() => setShareHref(props.shareHref), [props.shareHref]);

  const locked = status === "approved" || status === "sent" || !props.canEdit;
  const blocked = status === "collecting" || status === "failed";

  const run = (fn: () => Promise<ActionResult>, onOk: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) onOk();
      else setError(r.error);
    });
  };

  const persistNotes = async () => {
    if (notes === lastSaved.current) return true;
    setSaved("saving");
    const r = await saveNotes({ siteId: props.siteId, notes });
    if (!r.ok) {
      setSaved("dirty");
      setError(r.error);
      return false;
    }
    lastSaved.current = notes;
    setSaved("saved");
    return true;
  };

  const review = (action: "submit" | "approve" | "approve_partial" | "withdraw", to: ReportStatus, message: string) =>
    run(async () => {
      if (!(await persistNotes())) return { ok: false, error: "Your note could not be saved, so nothing else was changed." };
      return reviewReport({ siteId: props.siteId, action });
    }, () => { setStatus(to); setToast(message); });

  return (
    <div className="flex flex-col gap-6">
      <WorkflowStepper status={status} />

      {!props.canEdit && (
        <p className="flex gap-2 rounded-md bg-sunken p-3 text-small text-ink-2">
          <Eye size={16} className="mt-0.5 shrink-0" aria-hidden />You are signed in as a viewer. You can read and download reports but not change them.
        </p>
      )}

      {blocked && (
        <p className="flex gap-2 rounded-md bg-act-soft p-3 text-small text-act">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          {status === "failed"
            ? props.failureNote ?? "A source failed after three attempts. You can approve with that section marked unavailable."
            : "Search Console has not finalised the month yet. The report will be ready after the next retry."}
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
          <span className="text-micro text-ink-3" aria-live="polite">
            {locked && props.canEdit ? "Locked after approval" : saved === "saving" ? "Saving…" : saved === "dirty" ? "Not saved yet" : "Saved"}
          </span>
        </div>
        <textarea
          id="notes"
          value={notes}
          disabled={locked}
          maxLength={800}
          onChange={(e) => { setNotes(e.target.value); setSaved("dirty"); }}
          onBlur={() => void persistNotes()}
          rows={5}
          placeholder="Add context the numbers can't give: what you worked on, what's planned next."
          className="w-full resize-y rounded-md bg-raised p-3 text-body leading-6 text-ink hairline placeholder:text-ink-4 transition-shadow duration-(--duration-fast) focus:shadow-[inset_0_0_0_1.5px_var(--accent)] focus:outline-none disabled:bg-sunken disabled:text-ink-3"
        />
        <p className="mt-1 text-micro text-ink-3">Appears on the recommendations page, signed with your name. {notes.length}/800</p>
      </section>

      <section className="rounded-md bg-sunken/60 p-3">
        <p className="flex items-center gap-2 text-small text-ink-2">
          <EnvelopeSimple size={15} className="text-ink-3" aria-hidden />
          Sends to <span className="font-medium text-ink">{props.contact.name}</span>
        </p>
        <p className="mt-0.5 pl-[23px] text-micro text-ink-3">{props.contact.email} · PDF attached, plus a web link valid for 90 days</p>
        <div className="mt-3 flex items-center justify-between gap-3 pl-[23px] text-small text-ink-2">
          <span id="autosend-label">Send automatically next month</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoSend}
            aria-labelledby="autosend-label"
            disabled={!props.canEdit || pending}
            onClick={() => {
              const on = !autoSend;
              setAutoSend(on);
              run(() => setClientFlag({ clientId: props.clientId, flag: "autoSend", on }), () => setToast(on ? "Auto-send on. Next month's report goes out without review." : "Auto-send off. Reports will wait for approval."));
            }}
            className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-(--duration-fast) disabled:opacity-50", autoSend ? "bg-accent" : "bg-line-strong")}
          >
            <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-raised shadow-sm transition-transform duration-(--duration-fast) ease-(--ease-standard)", autoSend && "translate-x-4")} />
          </button>
        </div>
      </section>

      {error && <p role="alert" className="rounded-md bg-act-soft p-3 text-small text-act">{error}</p>}

      <div className="flex flex-col gap-2">
        {props.canEdit && (status === "in_review" || status === "draft") && (
          <Button variant="primary" className="w-full" disabled={pending} onClick={() => review("approve", "approved", "Report approved. Send it now or let the next run deliver it.")}>
            <CheckCircle size={16} weight="bold" aria-hidden />Approve report
          </Button>
        )}
        {props.canEdit && status === "draft" && (
          <Button variant="quiet" className="w-full" disabled={pending} onClick={() => review("submit", "in_review", "Marked as in review.")}>
            Mark as in review
          </Button>
        )}
        {props.canEdit && status === "failed" && (
          <Button variant="primary" className="w-full" disabled={pending} onClick={() => review("approve_partial", "approved", "Approved, with the unavailable section marked as such.")}>
            <CheckCircle size={16} weight="bold" aria-hidden />Approve without that section
          </Button>
        )}
        {props.canEdit && status === "approved" && (
          <>
            <Button
              variant="primary"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const r = await sendNow({ siteId: props.siteId });
                  if (!r.ok) return setError(r.error);
                  setStatus("sent");
                  setToast(r.captured ? `Email to ${props.contact.name} captured in test mode. See Sent emails.` : `Sent to ${props.contact.name}.`);
                });
              }}
            >
              <PaperPlaneTilt size={16} weight="bold" aria-hidden />{pending ? "Sending…" : "Send now"}
            </Button>
            <Button variant="quiet" className="w-full" disabled={pending} onClick={() => review("withdraw", "in_review", "Approval withdrawn. The report is back in review.")}>
              <ArrowCounterClockwise size={15} aria-hidden />Withdraw approval
            </Button>
          </>
        )}
        {status === "sent" && (
          <p className="flex flex-col items-center justify-center gap-0.5 rounded-md bg-good-soft py-2 text-small font-medium text-good">
            <span className="flex items-center gap-2"><PaperPlaneTilt size={15} weight="fill" aria-hidden />Sent to {props.contact.name}</span>
            {props.deliveryStatus && <span className="text-micro font-normal">{DELIVERY[props.deliveryStatus] ?? props.deliveryStatus}</span>}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a href={props.pdfHref} className={buttonClass({ variant: "secondary", size: "sm" })}>
            <DownloadSimple size={14} aria-hidden />PDF
          </a>
          {shareHref ? (
            <a href={shareHref} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
              <LinkIcon size={14} aria-hidden />Web version<ArrowSquareOut size={12} className="text-ink-4" aria-hidden />
            </a>
          ) : (
            <span className={buttonClass({ variant: "secondary", size: "sm", className: "pointer-events-none opacity-60" })}>
              <LinkBreak size={14} aria-hidden />Link revoked
            </span>
          )}
        </div>
        {props.canEdit && (
          <div className="flex justify-end gap-3 text-micro">
            {shareHref ? (
              <button type="button" disabled={pending} className="text-ink-3 underline-offset-2 hover:text-act hover:underline" onClick={() => run(() => revokeLink({ siteId: props.siteId }), () => { setShareHref(null); setToast("Client link revoked. It now shows a not-found page."); })}>
                Revoke client link
              </button>
            ) : (
              <button type="button" disabled={pending} className="flex items-center gap-1 text-ink-3 underline-offset-2 hover:text-accent hover:underline" onClick={() => run(() => reissueLink({ siteId: props.siteId }), () => { setToast("New 90-day link issued."); })}>
                <ArrowsClockwise size={11} aria-hidden />Issue a new link
              </button>
            )}
          </div>
        )}
      </div>

      <p className="border-t border-line pt-4 text-micro text-ink-3">
        Version {props.version} · every change is recorded in the audit log.{props.demo && " Demo changes are kept in your browser only."}
      </p>
      <Toast message={toast} onDone={clear} />
    </div>
  );
}
