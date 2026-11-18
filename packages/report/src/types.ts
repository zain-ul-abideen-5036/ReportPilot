import type { Narrative, ReportData } from "@reportpilot/core";

export interface ReportBrand {
  name: string;
  primary: string;
  accent: string;
  footer: string;
  /** Short mark for the cover when no logo image is uploaded. */
  initials?: string;
  logoUrl?: string | null;
}

export interface ReportInput {
  report: ReportData;
  narrative: Narrative;
  org: ReportBrand;
  client: { name: string };
  preparedBy: string;
  managerNotes?: string | null;
  /** When the report was generated, for the appendix. */
  generatedAt: string;
}

/** Derived values every page needs. */
export interface ReportContext extends ReportInput {
  monthLabel: string;
  pageCount: number;
}
