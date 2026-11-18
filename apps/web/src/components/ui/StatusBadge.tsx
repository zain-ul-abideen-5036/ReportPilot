import { CheckCircle, CircleDashed, PaperPlaneTilt, PencilSimpleLine, Eye, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import type { ReportStatus } from "@reportpilot/demo";
import { STATUS_HINT, STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/cn";

const STYLE: Record<ReportStatus, { icon: typeof CheckCircle; cls: string }> = {
  collecting: { icon: CircleDashed, cls: "text-ink-3 bg-sunken" },
  draft: { icon: PencilSimpleLine, cls: "text-ink-2 bg-sunken" },
  in_review: { icon: Eye, cls: "text-watch bg-watch-soft" },
  approved: { icon: CheckCircle, cls: "text-accent bg-accent-soft" },
  sent: { icon: PaperPlaneTilt, cls: "text-good bg-good-soft" },
  failed: { icon: WarningOctagon, cls: "text-act bg-act-soft" },
};

export function StatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const s = STYLE[status];
  const Icon = s.icon;
  return (
    <span
      title={STATUS_HINT[status]}
      className={cn("inline-flex items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-small font-medium whitespace-nowrap", s.cls, className)}
    >
      <Icon size={13} weight="bold" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
