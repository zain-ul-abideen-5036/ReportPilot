/**
 * The approval workflow: Draft → In review → Approved → Sent, with the
 * manager's commentary along the way. Every status change in the
 * dashboard goes through here, so the database and the UI can never
 * disagree about what is allowed, or who is allowed to do it.
 */

export type ReportStatus = "collecting" | "draft" | "in_review" | "approved" | "sent" | "failed";
export type Role = "owner" | "manager" | "viewer";

export type ReviewAction = "submit" | "approve" | "withdraw" | "send" | "approve_partial";

const TRANSITIONS: Record<ReviewAction, { from: ReportStatus[]; to: ReportStatus }> = {
  submit: { from: ["draft"], to: "in_review" },
  approve: { from: ["draft", "in_review"], to: "approved" },
  // A report whose speed collection failed can still go out, with that section marked unavailable.
  approve_partial: { from: ["failed"], to: "approved" },
  withdraw: { from: ["approved"], to: "in_review" },
  send: { from: ["approved"], to: "sent" },
};

/** Viewers can read everything and change nothing. */
export function canEdit(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/** Branding and team settings belong to the agency owner. */
export function canManageAgency(role: Role): boolean {
  return role === "owner";
}

export function nextStatus(action: ReviewAction, from: ReportStatus, role: Role): { ok: true; to: ReportStatus } | { ok: false; reason: string } {
  if (!canEdit(role)) return { ok: false, reason: "Viewers can read reports but not change them." };
  const t = TRANSITIONS[action];
  if (!t.from.includes(from)) return { ok: false, reason: `A report that is ${from.replace("_", " ")} cannot be ${PAST[action]}.` };
  return { ok: true, to: t.to };
}

const PAST: Record<ReviewAction, string> = {
  submit: "submitted for review",
  approve: "approved",
  approve_partial: "approved without speed data",
  withdraw: "withdrawn",
  send: "sent",
};

/** Notes can be edited until the report is approved; after that the PDF is what the client will see. */
export function notesEditable(status: ReportStatus): boolean {
  return status === "draft" || status === "in_review" || status === "failed" || status === "collecting";
}
