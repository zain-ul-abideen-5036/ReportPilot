import { ArrowDownRight, ArrowUpRight, Minus } from "@phosphor-icons/react/dist/ssr";
import { formatSignedNumber, formatSignedPct, isImprovement, trendOf, type Change, type Direction } from "@reportpilot/core";
import { cn } from "@/lib/cn";

interface DeltaProps {
  change: Change;
  direction?: Direction;
  /** "pct" shows relative change; "abs" shows the absolute difference (for position). */
  mode?: "pct" | "abs";
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A change figure. Colour says good or bad *for this metric*, the arrow
 * says which way the number moved; a position going from 8.1 to 6.4 is
 * a down arrow in green.
 */
export function Delta({ change, direction = "higher-is-better", mode = "pct", label, size = "sm", className }: DeltaProps) {
  const trend = trendOf(change);
  const good = isImprovement(change, direction);
  const text = mode === "pct" ? formatSignedPct(change.pct) : formatSignedNumber(change.delta);
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const tone = good === null ? "text-ink-3" : good ? "text-good" : "text-act";
  return (
    <span className={cn("inline-flex items-center gap-1 tnum font-medium whitespace-nowrap", size === "sm" ? "text-small" : "text-body", tone, className)}>
      <Icon weight="bold" size={size === "sm" ? 12 : 14} aria-hidden />
      <span>{text}</span>
      {label && <span className="font-normal text-ink-3">{label}</span>}
      <span className="sr-only">{good === null ? "(no meaningful change)" : good ? "(improvement)" : "(decline)"}</span>
    </span>
  );
}
