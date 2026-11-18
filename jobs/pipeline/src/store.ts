import type { CollectedData, Narrative, ReportData } from "@reportpilot/core";
import type { ReportStatus, Stage } from "@reportpilot/demo";

/**
 * What the pipeline needs from storage. Production uses Postgres
 * (pg-store.ts); demo, dry runs and tests use the in-memory store.
 */

export interface PipelineSite {
  id: string;
  orgId: string;
  clientName: string;
  url: string;
  gscProperty: string | null;
  brandedRegex: string | null;
  keyPages: string[];
  timezone: string;
  reportDay: number;
  autoSend: boolean;
  aiEnabled: boolean;
  contacts: Array<{ name: string; email: string }>;
  managerName: string;
  brand: { name: string; primary: string; accent: string; footer: string; senderName: string; senderEmail: string };
}

export interface StoredReport {
  id: string;
  siteId: string;
  period: string;
  status: ReportStatus;
  /** The last stage that completed; the runner resumes after it. */
  stage: Stage | null;
  collected: CollectedData | null;
  data: ReportData | null;
  narrative: Narrative | null;
  managerNotes: string | null;
  pdfKey: string | null;
  shareToken: string | null;
  sentAt: string | null;
}

export interface PipelineStore {
  sites(filter?: { siteId?: string }): Promise<PipelineSite[]>;
  /** Insert or return the existing report for (site, period). Never duplicates. */
  ensureReport(siteId: string, period: string): Promise<StoredReport>;
  updateReport(id: string, patch: Partial<StoredReport>): Promise<StoredReport>;
  recordRun(run: { siteId: string; period: string; stage: Stage; status: "running" | "succeeded" | "failed" | "waiting"; attempts: number; error?: string | null }): Promise<void>;
  audit(entry: { orgId: string; action: string; entityId: string; meta?: Record<string, unknown> }): Promise<void>;
}

export function memoryStore(sites: PipelineSite[]) {
  const reports = new Map<string, StoredReport>();
  const runs: Array<Parameters<PipelineStore["recordRun"]>[0]> = [];
  const auditLog: Array<Parameters<PipelineStore["audit"]>[0]> = [];
  let seq = 0;
  const store: PipelineStore = {
    async sites(filter) {
      return filter?.siteId ? sites.filter((s) => s.id === filter.siteId) : sites;
    },
    async ensureReport(siteId, period) {
      const key = `${siteId}:${period}`;
      const existing = reports.get(key);
      if (existing) return existing;
      const r: StoredReport = {
        id: `rep_${++seq}`, siteId, period, status: "collecting", stage: null, collected: null, data: null,
        narrative: null, managerNotes: null, pdfKey: null, shareToken: null, sentAt: null,
      };
      reports.set(key, r);
      return r;
    },
    async updateReport(id, patch) {
      const r = [...reports.values()].find((x) => x.id === id);
      if (!r) throw new Error(`No report ${id}`);
      Object.assign(r, patch);
      return r;
    },
    async recordRun(run) { runs.push(run); },
    async audit(entry) { auditLog.push(entry); },
  };
  return { store, reports, runs, auditLog };
}
