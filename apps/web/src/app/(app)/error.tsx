"use client";

import { useEffect } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

/** Says what happened and offers the one thing that usually fixes it. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-[46ch] flex-col items-center py-32 text-center">
      <p className="font-display text-headline text-ink">We couldn't load this page.</p>
      <p className="mt-3 text-body text-ink-3">
        Nothing has been sent or changed. Try again; if it keeps happening, the error reference below helps us find it.
      </p>
      {error.digest && <code className="mt-4 rounded-xs bg-sunken px-2 py-1 font-mono text-micro text-ink-3">{error.digest}</code>}
      <Button className="mt-8" variant="primary" onClick={reset}><ArrowClockwise size={15} aria-hidden />Try again</Button>
    </div>
  );
}
