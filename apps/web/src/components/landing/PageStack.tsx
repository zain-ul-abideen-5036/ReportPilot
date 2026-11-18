import type { ReportInput } from "@reportpilot/report";
import { ReportDocument } from "@reportpilot/report";

/**
 * Real report pages, fanned like a printed stack. These are the same
 * components the PDF is printed from, scaled down, not a screenshot.
 */
export function PageStack({ input, scale = 0.46 }: { input: ReportInput; scale?: number }) {
  const w = 794 * scale;
  const h = 1123 * scale;
  const sheets = [
    { limit: 3, skip: 2, r: "5deg", x: w * 0.42, y: h * 0.1, delay: 260 },
    { limit: 2, skip: 1, r: "-2.5deg", x: w * 0.2, y: h * 0.05, delay: 140 },
    { limit: 1, skip: 0, r: "-7deg", x: 0, y: 0, delay: 0 },
  ];
  return (
    <div className="relative" style={{ width: w * 1.5, height: h * 1.18 }} aria-hidden>
      {sheets.map((s) => (
        <div
          key={s.skip}
          className="absolute top-0 left-0"
          style={{
            transform: `translate(${s.x}px, ${s.y}px)`,
          }}
        >
          <div
            className="overflow-hidden rounded-[4px] shadow-sheet"
            style={{
              width: w,
              height: h,
              ["--r" as string]: s.r,
              transform: `rotate(${s.r})`,
              animation: `float-in 900ms var(--ease-standard) ${s.delay}ms both`,
            }}
          >
            <div style={{ width: 794, transform: `scale(${scale})`, transformOrigin: "top left", marginTop: -1123 * s.skip * scale }}>
              <ReportDocument {...input} limit={s.limit} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
