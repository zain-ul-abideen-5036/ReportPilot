import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-16 font-display text-[7rem] leading-none tracking-[-0.04em] text-ink-4 italic">404</p>
      <h1 className="mt-4 font-display text-headline text-ink">This page isn't here</h1>
      <p className="mt-3 max-w-[42ch] text-body text-ink-3">
        If you followed a report link, it may have expired or been revoked. Ask your agency for a new one.
      </p>
      <Link href="/dashboard" className={buttonClass({ variant: "secondary", className: "mt-8" })}>Go to the dashboard</Link>
    </main>
  );
}
