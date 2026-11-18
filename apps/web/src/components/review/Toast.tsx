"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useEffect } from "react";

/** A quiet confirmation in the corner. Announced to screen readers; no exclamation marks. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-(--z-toast) flex justify-center px-4">
      {message && (
        <div key={message} className="pointer-events-auto flex animate-enter items-center gap-2.5 rounded-lg bg-ink px-4 py-2.5 text-small text-paper shadow-sheet">
          <CheckCircle size={16} weight="fill" className="text-[color:var(--accent-soft)]" aria-hidden />
          {message}
        </div>
      )}
    </div>
  );
}
