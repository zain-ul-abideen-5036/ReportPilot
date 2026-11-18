import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/shell/Logo";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-(--z-sticky) border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="ReportPilot home"><Logo /></Link>
        <nav aria-label="Sections" className="hidden items-center gap-8 text-small text-ink-2 md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#report" className="hover:text-ink">The report</a>
          <a href="#trust" className="hover:text-ink">Reliability</a>
          <a href="#cost" className="hover:text-ink">Cost</a>
        </nav>
        <Link href="/dashboard" className="press group inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-small font-medium text-paper hover:bg-ink-2">
          Open the demo
          <ArrowUpRight size={14} weight="bold" className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
