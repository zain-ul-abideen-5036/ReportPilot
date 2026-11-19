"use client";

import { useState } from "react";
import { Check, UploadSimple } from "@phosphor-icons/react";
import type { Narrative, ReportData } from "@reportpilot/core";
import { ReportDocument } from "@reportpilot/report";
import { ScaledDocument } from "@/components/review/ScaledDocument";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/review/Toast";
import { cn } from "@/lib/cn";

const PRESETS = [
  { name: "Pine", primary: "#1f4d3f", accent: "#c8763b" },
  { name: "Cobalt", primary: "#0b5cc4", accent: "#e8a33d" },
  { name: "Terracotta", primary: "#9c4527", accent: "#2f4858" },
  { name: "Violet", primary: "#5b34c4", accent: "#13a3b5" },
  { name: "Ultramarine", primary: "#2a46c9", accent: "#ef8648" },
  { name: "Graphite", primary: "#2b2f33", accent: "#d14d41" },
];

/** WCAG relative luminance contrast against white, so we can warn about pale brand colours. */
function contrastOnWhite(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return 1.05 / (L + 0.05);
}

interface Props {
  initial: { name: string; primary: string; accent: string; senderName: string; senderEmail: string; footer: string };
  sample: { report: ReportData; narrative: Narrative; client: string; preparedBy: string; generatedAt: string };
}

export function BrandingStudio({ initial, sample }: Props) {
  const [brand, setBrand] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);
  const set = <K extends keyof typeof brand>(k: K, v: (typeof brand)[K]) => setBrand((b) => ({ ...b, [k]: v }));
  const lowContrast = contrastOnWhite(brand.primary) < 4.5;
  const initials = brand.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[360px_minmax(0,1fr)] xl:gap-14">
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          setToast("Brand saved. Next month's reports will use it.");
        }}
      >
        <fieldset>
          <legend className="mb-3 text-small font-semibold text-ink">Palette</legend>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const active = p.primary === brand.primary && p.accent === brand.accent;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setBrand((b) => ({ ...b, primary: p.primary, accent: p.accent }))}
                  aria-pressed={active}
                  className={cn("press group rounded-md p-2 text-left hairline hover:bg-surface", active && "shadow-[inset_0_0_0_1.5px_var(--accent)]")}
                >
                  <span className="flex h-7 overflow-hidden rounded-xs">
                    <span className="flex-[3]" style={{ background: p.primary }} />
                    <span className="flex-1" style={{ background: p.accent }} />
                  </span>
                  <span className="mt-1.5 flex items-center justify-between text-micro text-ink-2">
                    {p.name}
                    {active && <Check size={11} weight="bold" className="text-accent" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["primary", "accent"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1.5">
                <span className="text-micro text-ink-3 capitalize">{k}</span>
                <span className="flex h-9 items-center gap-2 rounded-md bg-raised px-2 hairline focus-within:shadow-[inset_0_0_0_1.5px_var(--accent)]">
                  <input type="color" value={brand[k]} onChange={(e) => set(k, e.target.value)} className="size-6 cursor-pointer rounded-xs border-0 bg-transparent p-0" aria-label={`${k} colour picker`} />
                  <input value={brand[k]} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set(k, e.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink uppercase focus:outline-none" aria-label={`${k} colour hex`} />
                </span>
              </label>
            ))}
          </div>
          {lowContrast && (
            <p className="mt-2 text-micro text-watch" role="status">
              This primary colour is pale against white ({contrastOnWhite(brand.primary).toFixed(1)}:1). Headings may be hard to read; aim for 4.5:1.
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-small font-semibold text-ink">Identity</legend>
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-lg text-small font-bold text-white" style={{ background: brand.primary }}>{initials}</span>
            <Button type="button" variant="secondary" size="sm"><UploadSimple size={14} aria-hidden />Upload logo</Button>
            <span className="text-micro text-ink-3">SVG or PNG, at least 240 px</span>
          </div>
          <Field label="Agency name" value={brand.name} onChange={(v) => set("name", v)} />
          <Field label="Footer line" value={brand.footer} onChange={(v) => set("footer", v)} hint="Printed at the foot of every page." />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-small font-semibold text-ink">Email</legend>
          <Field label="Sender name" value={brand.senderName} onChange={(v) => set("senderName", v)} />
          <Field label="Sender address" value={brand.senderEmail} onChange={(v) => set("senderEmail", v)} type="email" hint="Verified with SPF, DKIM and DMARC so reports don't land in spam." />
        </fieldset>

        <div className="flex gap-2">
          <Button type="submit" variant="primary">Save brand</Button>
          <Button type="button" variant="quiet" onClick={() => setBrand(initial)}>Reset</Button>
        </div>
      </form>

      <div className="min-w-0 lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100svh-3rem)] lg:flex-col lg:self-start">
        <p className="mb-3 flex items-baseline justify-between text-small">
          <span className="font-semibold text-ink">Live preview</span>
          <span className="text-ink-3">{sample.client}, cover and summary</span>
        </p>
        <div className="rounded-lg bg-sunken p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain [scrollbar-width:thin]">
          <ScaledDocument pages={2} gap={20}>
            <div className="[&_.rp-page]:rounded-[3px] [&_.rp-page]:shadow-sheet">
              <ReportDocument
                limit={2}
                gap={20}
                report={sample.report}
                narrative={sample.narrative}
                org={{ name: brand.name, primary: brand.primary, accent: brand.accent, footer: brand.footer, initials }}
                client={{ name: sample.client }}
                preparedBy={sample.preparedBy}
                generatedAt={sample.generatedAt}
              />
            </div>
          </ScaledDocument>
        </div>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function Field({ label, value, onChange, hint, type = "text" }: { label: string; value: string; onChange: (v: string) => void; hint?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-micro text-ink-3">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md bg-raised px-3 text-body text-ink hairline transition-shadow duration-(--duration-fast) focus:shadow-[inset_0_0_0_1.5px_var(--accent)] focus:outline-none"
      />
      {hint && <span className="text-micro text-ink-4">{hint}</span>}
    </label>
  );
}
