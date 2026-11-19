import { describe, expect, it } from "vitest";
import { canManageAgency, nextStatus, notesEditable } from "../src/workflow";

describe("approval workflow", () => {
  it("follows draft → in review → approved → sent", () => {
    expect(nextStatus("submit", "draft", "manager")).toEqual({ ok: true, to: "in_review" });
    expect(nextStatus("approve", "in_review", "manager")).toEqual({ ok: true, to: "approved" });
    expect(nextStatus("send", "approved", "manager")).toEqual({ ok: true, to: "sent" });
  });

  it("lets a manager withdraw an approval but never un-send", () => {
    expect(nextStatus("withdraw", "approved", "manager")).toEqual({ ok: true, to: "in_review" });
    expect(nextStatus("withdraw", "sent", "manager").ok).toBe(false);
  });

  it("refuses to send what nobody approved", () => {
    const r = nextStatus("send", "in_review", "owner");
    expect(r).toEqual({ ok: false, reason: "A report that is in review cannot be sent." });
  });

  it("allows approving a failed report only as a partial approval", () => {
    expect(nextStatus("approve", "failed", "manager").ok).toBe(false);
    expect(nextStatus("approve_partial", "failed", "manager")).toEqual({ ok: true, to: "approved" });
  });

  it("gives viewers read-only access and branding to owners", () => {
    expect(nextStatus("approve", "in_review", "viewer").ok).toBe(false);
    expect(canManageAgency("manager")).toBe(false);
    expect(canManageAgency("owner")).toBe(true);
  });

  it("locks notes once a report is approved", () => {
    expect(notesEditable("in_review")).toBe(true);
    expect(notesEditable("approved")).toBe(false);
    expect(notesEditable("sent")).toBe(false);
  });
});
