import { useId } from "react";

/**
 * The mark: a folded report sheet whose fold is a rising line. Drawn on a
 * 24px grid with a 1.75 stroke to sit with Phosphor's regular weight.
 *
 * Each instance gets its own gradient id. The sidebar and the mobile top bar
 * both render the mark; with a shared id the visible one would point at the
 * gradient inside the hidden one and paint nothing.
 */
export function LogoMark({ size = 26 }: { size?: number }) {
  const gradient = `rp-mark${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1a4437" />
          <stop offset="0.62" stopColor="#2c6450" />
          <stop offset="1" stopColor="#b4813f" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="7" fill={`url(#${gradient})`} />
      <path d="M8.5 6.5h7.25L20 10.75V21.5H8.5z" fill="var(--accent-ink)" fillOpacity="0.14" stroke="var(--accent-ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15.5 6.75V11h4.25" stroke="var(--accent-ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 18l2.25-2.5 1.75 1.5 2.5-3" stroke="var(--accent-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {withWordmark && (
        <span className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
          Report<span className="text-ink-3">Pilot</span>
        </span>
      )}
    </span>
  );
}
