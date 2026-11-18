import { cn } from "@/lib/cn";

/**
 * Client and user marks. Hue is derived from the name so each client keeps
 * its colour everywhere, but all hues share one lightness and chroma, so
 * the list reads as a set rather than a sweet jar.
 */
function hueOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Monogram({ name, initials, size = "md", shape = "square", className }: {
  name: string;
  initials: string;
  size?: "sm" | "md" | "lg";
  shape?: "square" | "round";
  className?: string;
}) {
  const hue = hueOf(name);
  const dims = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-11 text-[15px]" : "size-8 text-micro";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold tracking-wide",
        shape === "round" ? "rounded-full" : "rounded-md",
        dims,
        className,
      )}
      style={{
        // light-dark() follows the page's color-scheme, so marks re-tone in dark mode.
        background: `light-dark(oklch(0.93 0.035 ${hue}), oklch(0.3 0.045 ${hue}))`,
        color: `light-dark(oklch(0.38 0.07 ${hue}), oklch(0.86 0.06 ${hue}))`,
        boxShadow: `inset 0 0 0 1px light-dark(oklch(0.85 0.05 ${hue} / 0.6), oklch(0.42 0.05 ${hue} / 0.7))`,
      }}
    >
      {initials}
    </span>
  );
}
