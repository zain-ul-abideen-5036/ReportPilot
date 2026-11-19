import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/shell/Logo";
import { getSession } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/auth/session";
import { signInDemo } from "@/lib/actions";
import { EmailSignIn } from "./EmailSignIn";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  expired: "That sign-in link has expired or was already used. Ask for a new one.",
  link: "That sign-in link is not valid.",
  "demo-off": "The demo accounts are off on this deployment. Sign in with your work email.",
};

const DEMO_PEOPLE = [
  { role: "manager", name: "Tom Haverley", title: "Account manager", body: "Review drafts, add notes, approve and send." },
  { role: "owner", name: "Amara Osei", title: "Agency owner", body: "Everything a manager can do, plus branding." },
  { role: "viewer", name: "Finn Doyle", title: "Viewer", body: "Read-only. Every action is refused politely." },
] as const;

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/dashboard", error } = await searchParams;
  if (await getSession()) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  const demo = isDemoMode();

  return (
    <main className="grain flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Link href="/" aria-label="ReportPilot home" className="inline-block"><Logo /></Link>
        <h1 className="mt-10 font-display text-headline text-ink">Sign in</h1>
        <p className="mt-2 text-body text-ink-3">
          {demo ? "This is the public demo. Pick a person from the sample agency to see the product through their role." : "We email you a link that signs you in. No password to remember."}
        </p>
        {error && ERRORS[error] && <p role="alert" className="mt-5 rounded-md bg-act-soft p-3 text-small text-act">{ERRORS[error]}</p>}

        {demo ? (
          <ul className="mt-8 flex flex-col gap-2">
            {DEMO_PEOPLE.map((p) => (
              <li key={p.role}>
                <form action={signInDemo}>
                  <input type="hidden" name="role" value={p.role} />
                  <input type="hidden" name="next" value={next} />
                  <button type="submit" className="press group flex w-full items-center gap-4 rounded-lg bg-raised p-4 text-left shadow-raised hover:shadow-[inset_0_0_0_1.5px_var(--accent)]">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-small font-semibold text-accent">
                      {p.name.split(" ").map((w) => w[0]).join("")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">Continue as {p.name}</span>
                      <span className="block text-small text-ink-3">{p.title} · {p.body}</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <EmailSignIn next={next} />
        )}

        <p className="mt-10 text-micro text-ink-4">
          {demo
            ? "Changes you make in the demo are kept in your browser only. Set DATABASE_URL and AUTH_SECRET to switch to email sign-in."
            : "Sessions last 14 days. Links work once and expire after 15 minutes."}
        </p>
      </div>
    </main>
  );
}
