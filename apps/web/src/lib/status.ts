import type { Light } from "@reportpilot/core";
import type { ReportStatus } from "@reportpilot/demo";

/** Labels live in one place so the dashboard, emails and PDF agree. */

export const STATUS_LABEL: Record<ReportStatus, string> = {
  collecting: "Collecting",
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  sent: "Sent",
  failed: "Needs attention",
};

export const STATUS_HINT: Record<ReportStatus, string> = {
  collecting: "Waiting for Search Console to finalise the month",
  draft: "Generated, not yet reviewed",
  in_review: "Waiting for approval",
  approved: "Queued for delivery",
  sent: "Delivered to the client",
  failed: "A stage failed after three attempts",
};

export const LIGHT_LABEL: Record<Light, string> = {
  good: "On track",
  watch: "Watch",
  act: "Act now",
  unknown: "No data",
};

export const AREA_LABEL = {
  search: "Search",
  speed: "Speed",
  reliability: "Reliability",
  indexing: "Indexing",
} as const;
