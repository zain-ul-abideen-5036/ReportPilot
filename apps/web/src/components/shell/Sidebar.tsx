"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell, ChartLineUp, FileText, GearSix, List, SquaresFour, Users, X, FlowArrow, CaretUpDown,
} from "@phosphor-icons/react";
import { NAV, isActive, type NavItem } from "./nav";
import { Logo } from "./Logo";
import { ThemeSwitch } from "./ThemeSwitch";
import { cn } from "@/lib/cn";

const ICONS: Record<NavItem["icon"], typeof Bell> = {
  overview: SquaresFour,
  reports: FileText,
  clients: Users,
  alerts: Bell,
  pipeline: FlowArrow,
  settings: GearSix,
};

interface SidebarProps {
  orgName: string;
  user: { name: string; initials: string; role: string };
  badges: { review: number; alerts: number };
  cycle: { label: string; sent: number; total: number };
}

function NavLinks({ badges, pathname, onNavigate }: { badges: SidebarProps["badges"]; pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-px">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = ICONS[item.icon];
        const count = item.badgeKey ? badges[item.badgeKey] : 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group press relative flex h-9 items-center gap-3 rounded-md pr-2 pl-3 text-body",
                active ? "font-medium text-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
              )}
            >
              {/* The rail's scale is the state, not a filled pill. */}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-2 left-0 w-0.5 origin-center rounded-full bg-accent transition-transform duration-(--duration-fast) ease-(--ease-standard)",
                  active ? "scale-y-100" : "scale-y-0 group-hover:scale-y-50",
                )}
              />
              <Icon size={18} weight={active ? "fill" : "regular"} className={active ? "text-accent" : "text-ink-3 group-hover:text-ink-2"} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className={cn(
                  "tnum min-w-5 rounded-xs px-1 text-center text-micro font-semibold",
                  item.badgeKey === "alerts" ? "bg-act-soft text-act" : "bg-watch-soft text-watch",
                )}>
                  {count}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CycleMeter({ cycle }: { cycle: SidebarProps["cycle"] }) {
  const pct = cycle.total ? cycle.sent / cycle.total : 0;
  return (
    <div className="rounded-md bg-sunken/70 p-3">
      <div className="flex items-baseline justify-between text-small">
        <span className="font-medium text-ink">{cycle.label}</span>
        <span className="tnum text-ink-3">{cycle.sent}/{cycle.total} sent</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full origin-left rounded-full bg-accent transition-transform duration-(--duration-settle) ease-(--ease-standard)"
          style={{ transform: `scaleX(${pct})` }}
        />
      </div>
    </div>
  );
}

export function Sidebar({ orgName, user, badges, cycle }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const body = (
    <>
      <div className="flex items-center justify-between px-3 pt-4 pb-5">
        <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="ReportPilot overview">
          <Logo />
        </Link>
      </div>
      <button
        type="button"
        className="press mx-2 mb-4 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-sunken"
        aria-label={`Workspace: ${orgName}`}
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-ink text-micro font-semibold text-paper">NF</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-medium text-ink">{orgName}</span>
          <span className="block text-micro text-ink-3">Agency workspace</span>
        </span>
        <CaretUpDown size={14} className="text-ink-4" aria-hidden />
      </button>
      <nav aria-label="Main" className="px-2">
        <NavLinks badges={badges} pathname={pathname} onNavigate={() => setOpen(false)} />
      </nav>
      <div className="mt-auto flex flex-col gap-3 p-3">
        <CycleMeter cycle={cycle} />
        <ThemeSwitch />
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-micro font-semibold text-accent">{user.initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-small font-medium text-ink">{user.name}</span>
            <span className="block text-micro text-ink-3 capitalize">{user.role}</span>
          </span>
          <ChartLineUp size={16} className="text-ink-4" aria-hidden />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: fixed rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">{body}</aside>

      {/* Mobile and tablet: top bar with a drawer */}
      <div className="sticky top-0 z-(--z-sticky) flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/dashboard" aria-label="ReportPilot overview"><Logo /></Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="press -mr-2 flex size-10 items-center justify-center rounded-md text-ink-2 hover:bg-sunken"
        >
          <List size={22} aria-hidden />
          <span className="sr-only">Open menu</span>
        </button>
      </div>
      <div
        className={cn(
          "fixed inset-0 z-(--z-overlay) bg-ink/30 backdrop-blur-[2px] transition-opacity duration-(--duration-settle) ease-(--ease-standard) lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        id="mobile-nav"
        aria-label="Menu"
        inert={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-(--z-overlay) flex w-72 max-w-[85vw] flex-col bg-surface shadow-sheet transition-transform duration-(--duration-settle) ease-(--ease-standard) lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="press absolute top-3 right-3 flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-sunken"
        >
          <X size={18} aria-hidden />
          <span className="sr-only">Close menu</span>
        </button>
        {body}
      </aside>
    </>
  );
}
