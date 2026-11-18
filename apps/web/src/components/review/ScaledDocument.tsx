"use client";

import { useLayoutEffect, useRef, useState } from "react";

const PAGE_WIDTH = 794;

/**
 * Shows the A4 report at whatever width the column allows. The document
 * keeps its print geometry and is scaled with a transform, so the preview
 * is pixel-for-pixel the PDF, only smaller.
 */
export function ScaledDocument({ children, pages, gap }: { children: React.ReactNode; pages: number; gap: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / PAGE_WIDTH));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = (pages * 1123 + (pages - 1) * gap) * scale;
  return (
    <div ref={outer} className="w-full" style={{ height: scale ? height : undefined }}>
      <div
        className="origin-top-left transition-opacity duration-(--duration-settle)"
        style={{ width: PAGE_WIDTH, transform: `scale(${scale || 1})`, opacity: scale ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}
