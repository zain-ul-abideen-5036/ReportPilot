import { cn } from "@/lib/cn";

/**
 * Page title block. The title is set in the display serif; everything
 * operational stays in the sans, so the serif marks "where am I".
 */
export function PageHeader({ eyebrow, title, description, actions, className }: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between md:gap-8", className)}>
      <div className="min-w-0 animate-enter">
        {eyebrow && <div className="mb-2 text-small text-ink-3">{eyebrow}</div>}
        <h1 className="font-display text-headline font-normal text-ink md:text-[2.375rem] md:leading-[2.625rem]">{title}</h1>
        {description && <p className="mt-2 max-w-[62ch] text-lead text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A section heading with a hairline, used instead of wrapping everything in cards. */
export function SectionHeading({ title, meta, action, id }: { title: string; meta?: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-line pb-2">
      <h2 id={id} className="text-body font-semibold text-ink">
        {title}
        {meta && <span className="ml-2 font-normal text-ink-3">{meta}</span>}
      </h2>
      {action}
    </div>
  );
}
