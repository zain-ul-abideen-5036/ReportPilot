"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle, Copy, CircleNotch, FilePdf, Plus, X } from "@phosphor-icons/react";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const STEPS = ["Client", "Site", "Search Console", "First report"] as const;
const SERVICE_ACCOUNT = "reports@reportpilot-prod.iam.gserviceaccount.com";

interface State {
  name: string;
  contactName: string;
  contactEmail: string;
  timezone: string;
  url: string;
  keyPages: string[];
  branded: string;
  keyword: string;
}

/**
 * Four steps, each short enough to finish without scrolling. Validation is
 * inline and only appears once someone has tried to continue, so the form
 * does not shout at people before they have typed anything.
 */
export function Wizard() {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [s, setS] = useState<State>({ name: "", contactName: "", contactEmail: "", timezone: "Europe/London", url: "", keyPages: ["/"], branded: "", keyword: "" });
  const [connection, setConnection] = useState<"idle" | "testing" | "ok">("idle");
  const [sample, setSample] = useState<"idle" | "working" | "ready">("idle");
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((x) => ({ ...x, [k]: v }));

  const errors: Record<string, string> = {};
  if (step === 0) {
    if (!s.name.trim()) errors.name = "Enter the client's business name.";
    if (!/^\S+@\S+\.\S+$/.test(s.contactEmail)) errors.contactEmail = "Enter an email address reports can be sent to.";
  }
  if (step === 1) {
    try {
      const u = new URL(s.url);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      errors.url = "Enter the full address, starting with https://";
    }
  }
  if (step === 2 && connection !== "ok") errors.connection = "Test the connection before continuing.";
  const valid = Object.keys(errors).length === 0;
  const err = (k: string) => (tried ? errors[k] : undefined);

  const next = () => {
    setTried(true);
    if (!valid) return;
    setTried(false);
    setStep((x) => Math.min(STEPS.length - 1, x + 1));
  };

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-10 grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <span className="block h-1 overflow-hidden rounded-full bg-line">
              <span className={cn("block h-full origin-left bg-accent transition-transform duration-(--duration-settle) ease-(--ease-standard)", i <= step ? "scale-x-100" : "scale-x-0")} />
            </span>
            <span className={cn("mt-2 block text-micro sm:text-small", i === step ? "font-medium text-ink" : i < step ? "text-ink-2" : "text-ink-4")}>
              <span className="mr-1 font-display italic">{i + 1}</span>{label}
            </span>
          </li>
        ))}
      </ol>

      <div key={step} className="animate-enter">
        {step === 0 && (
          <Section title="Who is the client?" body="Reports go to this contact. You can add more contacts later.">
            <Input label="Business name" value={s.name} onChange={(v) => set("name", v)} error={err("name")} placeholder="Harlow & Finch Dental" autoFocus />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Contact name" value={s.contactName} onChange={(v) => set("contactName", v)} placeholder="Dr Ruth Harlow" />
              <Input label="Contact email" type="email" value={s.contactEmail} onChange={(v) => set("contactEmail", v)} error={err("contactEmail")} placeholder="ruth@example.com" />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-small font-medium text-ink-2">Time zone</span>
              <select value={s.timezone} onChange={(e) => set("timezone", e.target.value)} className="h-10 rounded-md bg-raised px-3 text-body text-ink hairline focus:shadow-[inset_0_0_0_1.5px_var(--accent)] focus:outline-none">
                {["Europe/London", "Europe/Dublin", "Europe/Paris", "America/New_York", "Australia/Sydney"].map((tz) => <option key={tz}>{tz}</option>)}
              </select>
              <span className="text-micro text-ink-3">Reports are generated at 06:00 on the 3rd in this time zone.</span>
            </label>
          </Section>
        )}

        {step === 1 && (
          <Section title="Which site are we reporting on?" body="Up to five key pages get weekly speed tests and index checks.">
            <Input label="Website address" value={s.url} onChange={(v) => set("url", v)} error={err("url")} placeholder="https://www.example.com" autoFocus />
            <div>
              <span className="text-small font-medium text-ink-2">Key pages</span>
              <ul className="mt-1.5 flex flex-col gap-2">
                {s.keyPages.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <input value={p} onChange={(e) => set("keyPages", s.keyPages.map((x, j) => (j === i ? e.target.value : x)))} className="h-9 min-w-0 flex-1 rounded-md bg-raised px-3 font-mono text-[13px] text-ink hairline focus:shadow-[inset_0_0_0_1.5px_var(--accent)] focus:outline-none" aria-label={`Key page ${i + 1}`} />
                    {i > 0 && <button type="button" onClick={() => set("keyPages", s.keyPages.filter((_, j) => j !== i))} className="press flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-sunken" aria-label={`Remove key page ${i + 1}`}><X size={14} /></button>}
                  </li>
                ))}
              </ul>
              {s.keyPages.length < 5 && (
                <button type="button" onClick={() => set("keyPages", [...s.keyPages, "/"])} className="press mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-small font-medium text-accent hover:bg-accent-soft">
                  <Plus size={13} weight="bold" aria-hidden />Add page <span className="font-normal text-ink-4">{s.keyPages.length}/5</span>
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Brand terms" value={s.branded} onChange={(v) => set("branded", v)} placeholder="harlow|finch" hint="Separate with |. Splits branded from non-branded searches." mono />
              <Input label="Uptime keyword" value={s.keyword} onChange={(v) => set("keyword", v)} placeholder="Harlow & Finch" hint="Text that must appear on the homepage for it to count as up." />
            </div>
          </Section>
        )}

        {step === 2 && (
          <Section title="Connect Search Console" body="Read-only access through a service account. No Google sign-in, and the client can remove it at any time.">
            <ol className="flex flex-col gap-4 text-body text-ink-2">
              <li className="flex gap-3"><Num n={1} />In Search Console, open the property for {s.url ? new URL(s.url).hostname : "the site"} and go to Settings → Users and permissions.</li>
              <li className="flex gap-3"><Num n={2} />
                <span className="min-w-0 flex-1">
                  Add this address as a <strong className="font-medium text-ink">Restricted</strong> user:
                  <span className="mt-2 flex items-center gap-2 rounded-md bg-sunken p-1 pl-3">
                    <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{SERVICE_ACCOUNT}</code>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(SERVICE_ACCOUNT); setCopied(true); setTimeout(() => setCopied(false), 1600); }} className="press flex h-7 items-center gap-1.5 rounded-[6px] bg-raised px-2.5 text-small text-ink-2 shadow-raised">
                      {copied ? <Check size={13} weight="bold" className="text-good" /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}
                    </button>
                  </span>
                </span>
              </li>
              <li className="flex gap-3"><Num n={3} />Come back here and test the connection.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" disabled={connection === "testing"} onClick={() => { setConnection("testing"); setTimeout(() => setConnection("ok"), 1400); }}>
                {connection === "testing" ? <CircleNotch size={15} className="animate-spin" aria-hidden /> : connection === "ok" ? <CheckCircle size={15} weight="fill" className="text-good" aria-hidden /> : null}
                {connection === "testing" ? "Testing…" : connection === "ok" ? "Connected" : "Test connection"}
              </Button>
              <span role="status" className={cn("text-small", connection === "ok" ? "text-good" : err("connection") ? "text-act" : "text-ink-3")}>
                {connection === "ok" ? "Access confirmed. 16 months of history will be backfilled for year-on-year comparisons." : err("connection") ?? "Takes a few seconds."}
              </span>
            </div>
          </Section>
        )}

        {step === 3 && (
          <Section title="Generate a sample report" body="Uptime monitoring has started. Generate a report from the backfilled data to check everything looks right before the 3rd.">
            <div className="flex items-center gap-4 rounded-lg bg-raised p-5 shadow-raised">
              <span className="flex size-12 items-center justify-center rounded-md bg-accent-soft text-accent"><FilePdf size={24} weight="duotone" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{s.name || "New client"}, sample report</p>
                <p className="text-small text-ink-3">
                  {sample === "idle" && "About a minute. Nothing is sent to the client."}
                  {sample === "working" && "Collecting search data, running speed tests, rendering…"}
                  {sample === "ready" && "Ready. 8 pages, 1.2 MB."}
                </p>
                {sample === "working" && <span className="mt-2 block h-0.5 overflow-hidden rounded-full bg-line"><span className="block h-full w-1/4 animate-indeterminate rounded-full bg-accent" /></span>}
              </div>
              {sample === "ready" ? (
                <Link href="/reports/site_harlow" className={buttonClass({ variant: "primary", size: "sm" })}>Open</Link>
              ) : (
                <Button type="button" variant="primary" size="sm" disabled={sample === "working"} onClick={() => { setSample("working"); setTimeout(() => setSample("ready"), 2600); }}>Generate</Button>
              )}
            </div>
          </Section>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
        {step > 0 ? (
          <Button type="button" variant="quiet" onClick={() => { setTried(false); setStep((x) => x - 1); }}><ArrowLeft size={15} aria-hidden />Back</Button>
        ) : (
          <Link href="/clients" className={buttonClass({ variant: "quiet" })}>Cancel</Link>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="primary" onClick={next}>Continue<ArrowRight size={15} aria-hidden /></Button>
        ) : (
          <Link href="/clients" className={buttonClass({ variant: "primary" })}>Finish</Link>
        )}
      </div>
    </div>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-title text-ink">{title}</h2>
        <p className="mt-1 text-body text-ink-3">{body}</p>
      </div>
      {children}
    </section>
  );
}

function Num({ n }: { n: number }) {
  return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-micro font-semibold text-accent">{n}</span>;
}

function Input({ label, value, onChange, error, hint, placeholder, type = "text", autoFocus, mono }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; placeholder?: string; type?: string; autoFocus?: boolean; mono?: boolean;
}) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium text-ink-2">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(
          "h-10 rounded-md bg-raised px-3 text-body text-ink hairline placeholder:text-ink-4 transition-shadow duration-(--duration-fast) focus:outline-none",
          error ? "shadow-[inset_0_0_0_1.5px_var(--act)]" : "focus:shadow-[inset_0_0_0_1.5px_var(--accent)]",
          mono && "font-mono text-[13px]",
        )}
      />
      {error ? <span id={`${id}-error`} className="text-micro text-act">{error}</span> : hint ? <span id={`${id}-hint`} className="text-micro text-ink-3">{hint}</span> : null}
    </div>
  );
}
