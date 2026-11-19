"use client";

import { useRef, useState, useTransition } from "react";
import { Check, UploadSimple, X } from "@phosphor-icons/react";
import { saveBrand } from "@/lib/actions";
import { downscaleLogo } from "@/lib/logo";
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
  initial: { name: string; primary: string; accent: string; senderName: string; senderEmail: string; footer: string; logoUrl: string | null };
  canManage: boolean;
  demo: boolean;
  sample: { report: ReportData; narrative: Narrative; client: string; preparedBy: string; generatedAt: string };
}

export function BrandingStudio({ initial, sample, canManage, demo }: Props) {
  const [brand, setBrand] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof brand>(k: K, v: (typeof brand)[K]) => setBrand((b) => ({ ...b, [k]: v }));
  const lowContrast = contrastOnWhite(brand.primary) < 4.5;
  const initials = brand.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[360px_minmax(0,1fr)] xl:gap-14">
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await saveBrand({
              name: brand.name, primary: brand.primary, accent: brand.accent, senderName: brand.senderName, senderEmail: brand.senderEmail,
              footer: brand.footer, ...(logoChanged && { logo: brand.logoUrl }),
            });
            if (!r.ok) return setError(r.error);
            setLogoChanged(false);
            setToast(demo && logoChanged ? "Brand saved. In the demo the logo stays in this preview only." : "Brand saved. Next month's reports will use it.");
          });
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
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URL preview, not a remote image
              <img src={brand.logoUrl} alt="Agency logo" className="h-12 max-w-24 rounded-lg bg-raised object-contain p-1 hairline" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-lg text-small font-bold text-white" style={{ background: brand.primary }}>{initials}</span>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              aria-label="Upload logo"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  set("logoUrl", await downscaleLogo(file));
                  setLogoChanged(true);
                  setError(null);
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()}><UploadSimple size={14} aria-hidden />{brand.logoUrl ? "Replace" : "Upload logo"}</Button>
            {brand.logoUrl ? (
              <button type="button" onClick={() => { set("logoUrl", null); setLogoChanged(true); }} className="press flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-sunken" aria-label="Remove logo"><X size={14} /></button>
            ) : (
              <span className="text-micro text-ink-3">PNG, JPG or SVG; resized to 480 px</span>
            )}
          </div>
          <Field label="Agency name" value={brand.name} onChange={(v) => set("name", v)} />
          <Field label="Footer line" value={brand.footer} onChange={(v) => set("footer", v)} hint="Printed at the foot of every page." />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-small font-semibold text-ink">Email</legend>
          <Field label="Sender name" value={brand.senderName} onChange={(v) => set("senderName", v)} />
          <Field label="Sender address" value={brand.senderEmail} onChange={(v) => set("senderEmail", v)} type="email" hint="Verified with SPF, DKIM and DMARC so reports don't land in spam." />
        </fieldset>

        {error && <p role="alert" className="rounded-md bg-act-soft p-3 text-small text-act">{error}</p>}
        {!canManage && <p className="rounded-md bg-sunken p-3 text-small text-ink-2">Only the agency owner can save branding. You can still try colours in the preview.</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={pending || !canManage}>{pending ? "Saving…" : "Save brand"}</Button>
          <Button type="button" variant="quiet" onClick={() => { setBrand(initial); setLogoChanged(false); }}>Reset</Button>
        </div>
      </form>

      <div className="min-w-0 lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100svh-3rem)] lg:flex-col lg:self-start">
        <p className="mb-3 flex items-baseline justify-between text-small">
          <span className="font-semibold text-ink">Live preview</span>
          <span className="text-ink-3">{sample.client}, cover and summary</span>
        </p>
        <div tabIndex={0} role="region" aria-label="Report preview" className="rounded-lg bg-sunken p-4 focus-visible:outline-2 focus-visible:outline-accent sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain [scrollbar-width:thin]">
          <ScaledDocument pages={2} gap={20}>
            <div className="[&_.rp-page]:rounded-[3px] [&_.rp-page]:shadow-sheet">
              <ReportDocument
                limit={2}
                gap={20}
                report={sample.report}
                narrative={sample.narrative}
                org={{ name: brand.name, primary: brand.primary, accent: brand.accent, footer: brand.footer, initials, logoUrl: brand.logoUrl }}
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
