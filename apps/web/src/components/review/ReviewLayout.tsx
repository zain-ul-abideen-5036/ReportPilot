"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Two panes on desktop (document left, review right, sticky). On smaller
 * screens the same content becomes two tabs, so nobody has to scroll past
 * eight A4 pages to reach the approve button.
 */
export function ReviewLayout({ preview, panel, pageNav }: { preview: React.ReactNode; panel: React.ReactNode; pageNav: React.ReactNode }) {
  const [tab, setTab] = useState<"review" | "preview">("review");
  return (
    <>
      <div role="tablist" aria-label="Report view" className="mb-5 grid grid-cols-2 rounded-md bg-sunken p-1 lg:hidden">
        {(["review", "preview"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "press h-8 rounded-[6px] text-small font-medium capitalize",
              tab === t ? "bg-raised text-ink shadow-raised" : "text-ink-3",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-14">
        <div className={cn("min-w-0", tab !== "preview" && "hidden lg:block")}>
          {pageNav}
          <div className="rounded-lg bg-sunken p-3 sm:p-6 lg:p-8">{preview}</div>
        </div>
        <aside className={cn("lg:sticky lg:top-6 lg:self-start", tab !== "review" && "hidden lg:block")}>{panel}</aside>
      </div>
    </>
  );
}
