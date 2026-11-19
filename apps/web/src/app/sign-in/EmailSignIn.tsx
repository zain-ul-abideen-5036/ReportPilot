"use client";

import { useActionState } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { requestSignInLink } from "@/lib/actions";
import { Button } from "@/components/ui/Button";

export function EmailSignIn({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestSignInLink, { sent: false });
  if (state.sent) {
    return (
      <p role="status" className="mt-8 flex gap-3 rounded-lg bg-good-soft p-4 text-body text-good">
        <EnvelopeSimple size={20} className="mt-0.5 shrink-0" aria-hidden />
        If that address belongs to an agency member, a sign-in link is on its way. It works once, for 15 minutes.
      </p>
    );
  }
  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="text-small font-medium text-ink-2">Work email</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "email-error" : undefined}
        className="h-11 rounded-md bg-raised px-3 text-body text-ink hairline focus:shadow-[inset_0_0_0_1.5px_var(--accent)] focus:outline-none"
      />
      {state.error && <p id="email-error" className="text-micro text-act">{state.error}</p>}
      <Button type="submit" variant="primary" disabled={pending} className="mt-2 h-11">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
