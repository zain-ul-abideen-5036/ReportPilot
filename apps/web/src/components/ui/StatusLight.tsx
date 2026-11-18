import { CheckCircle, Circle, WarningCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import type { Light } from "@reportpilot/core";
import { LIGHT_LABEL } from "@/lib/status";
import { cn } from "@/lib/cn";

const TONE: Record<Light, { icon: typeof CheckCircle; text: string; bg: string }> = {
  good: { icon: CheckCircle, text: "text-good", bg: "bg-good-soft" },
  watch: { icon: Warning, text: "text-watch", bg: "bg-watch-soft" },
  act: { icon: WarningCircle, text: "text-act", bg: "bg-act-soft" },
  unknown: { icon: Circle, text: "text-ink-3", bg: "bg-sunken" },
};

/** Icon + colour + optional label: status never relies on colour alone. */
export function StatusLight({ light, area, showLabel = false, className }: { light: Light; area?: string; showLabel?: boolean; className?: string }) {
  const t = TONE[light];
  const Icon = t.icon;
  const label = `${area ? `${area}: ` : ""}${LIGHT_LABEL[light]}`;
  if (!showLabel) {
    return (
      <span className={cn("inline-flex size-6 items-center justify-center rounded-sm", t.bg, t.text, className)} title={label}>
        <Icon size={15} weight="fill" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-small font-medium", t.bg, t.text, className)}>
      <Icon size={14} weight="fill" aria-hidden />
      {label}
    </span>
  );
}
