import { CheckCircle, Database, FilePdf, PaperPlaneTilt, PenNib, ChartLineUp, UserCheck } from "@phosphor-icons/react/dist/ssr";

const NODES = [
  { icon: Database, label: "Collect", note: "Search Console, PageSpeed, CrUX, uptime" },
  { icon: ChartLineUp, label: "Calculate", note: "Changes, opportunities, vitals" },
  { icon: PenNib, label: "Write", note: "Rules, templates, checked AI" },
  { icon: FilePdf, label: "Render", note: "Branded A4 PDF" },
  { icon: UserCheck, label: "Review", note: "You add a note, approve" },
  { icon: PaperPlaneTilt, label: "Send", note: "Email, PDF, private link" },
];

/**
 * The pipeline as a track with six stations and a report travelling along
 * it. The token's movement is the information: work flows left to right
 * and stops for a person at "Review". CSS only; static under reduced motion.
 */
export function PipelineFlow() {
  return (
    <div className="reveal mt-14 rounded-[10px] bg-raised p-6 shadow-raised sm:p-10">
      <div className="relative hidden md:block">
        <div aria-hidden className="absolute top-6 right-[8%] left-[8%] h-px bg-line" />
        <div aria-hidden className="rule-gradient absolute top-6 right-[8%] left-[8%] h-px opacity-70" />
        <div aria-hidden className="absolute top-6 right-[8%] left-[8%] h-0 [--travel:calc(100%-14px)]">
          <span className="absolute -top-[7px] left-0 flex size-3.5 items-center justify-center rounded-full bg-brand shadow-[0_0_0_4px_rgb(29_74_60/0.12),0_4px_10px_rgb(29_74_60/0.35)] motion-safe:animate-[travel_7s_cubic-bezier(0.65,0,0.35,1)_infinite]" />
        </div>
        <ol className="relative grid grid-cols-6">
          {NODES.map((n, i) => (
            <li key={n.label} className="flex flex-col items-center text-center">
              <span className={`flex size-12 items-center justify-center rounded-full bg-raised shadow-[0_0_0_1px_var(--line),0_6px_16px_-10px_rgb(52_40_22/0.4)] ${i === 4 ? "text-brass" : "text-accent"}`}>
                <n.icon size={20} weight="duotone" aria-hidden />
              </span>
              <span className="mt-4 text-body font-semibold text-ink">{n.label}</span>
              <span className="mt-1 max-w-[16ch] text-small text-ink-3">{n.note}</span>
            </li>
          ))}
        </ol>
      </div>
      <ol className="flex flex-col gap-5 md:hidden">
        {NODES.map((n, i) => (
          <li key={n.label} className="flex items-start gap-4">
            <span className="relative flex flex-col items-center">
              <span className={`flex size-10 items-center justify-center rounded-full bg-raised shadow-[0_0_0_1px_var(--line)] ${i === 4 ? "text-brass" : "text-accent"}`}>
                <n.icon size={18} weight="duotone" aria-hidden />
              </span>
            </span>
            <span className="pt-1.5">
              <span className="block text-body font-semibold text-ink">{n.label}</span>
              <span className="block text-small text-ink-3">{n.note}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-8 flex items-center justify-center gap-2 border-t border-line pt-5 text-small text-ink-3">
        <CheckCircle size={15} weight="fill" className="text-good" aria-hidden />
        Every stage saves its work. A failed run picks up where it stopped.
      </p>
    </div>
  );
}
