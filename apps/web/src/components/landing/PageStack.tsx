import type { ReportInput } from "@reportpilot/report";
import { ReportDocument } from "@reportpilot/report";

const SCALE = 0.46;
const W = 794 * SCALE;
const H = 1123 * SCALE;

const SHEETS = [
  { page: 2, r: "5deg", x: 40 + W * 0.42, y: 12 + H * 0.1, delay: 260 },
  { page: 1, r: "-2.5deg", x: 40 + W * 0.2, y: 12 + H * 0.05, delay: 140 },
  { page: 0, r: "-7deg", x: 40, y: 12, delay: 0 },
];

/**
 * Real report pages, fanned like a printed stack: the same components the
 * PDF is printed from, scaled down, not a screenshot. Each sheet renders a
 * single page.
 *
 * The whole composition is drawn at one design size and scaled by --k, the
 * smaller of a width factor and a height factor set in globals.css, so it
 * fits a 360 px phone and a 1280 × 720 laptop alike without re-laying out.
 */
export function PageStack({ input, children }: { input: ReportInput; children?: React.ReactNode }) {
  return (
    <div className="hero-stack" aria-hidden>
      <div className="hero-stack-inner">
        {SHEETS.map((s) => (
          <div key={s.page} className="absolute top-0 left-0" style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
            <div
              className="overflow-hidden rounded-[4px] shadow-sheet"
              style={{
                width: W,
                height: H,
                ["--r" as string]: s.r,
                transform: `rotate(${s.r})`,
                animation: `float-in 900ms var(--ease-standard) ${s.delay}ms both`,
              }}
            >
              <div style={{ width: 794, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
                <ReportDocument {...input} only={s.page} />
              </div>
            </div>
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}
