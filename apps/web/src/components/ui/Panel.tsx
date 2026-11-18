import { cn } from "@/lib/cn";

/** A discrete object on the page. Used sparingly: most sections are a heading and a hairline. */
export function Panel({ title, meta, action, children, className, padded = true, as: Tag = "section" }: {
  title?: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  as?: "section" | "div" | "aside" | "article";
}) {
  return (
    <Tag className={cn("rounded-lg bg-raised shadow-raised", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-body font-semibold text-ink">
            {title}
            {meta && <span className="ml-2 font-normal text-ink-3">{meta}</span>}
          </h2>
          {action}
        </div>
      )}
      <div className={cn(padded && "px-5 pb-5", !title && padded && "pt-5")}>{children}</div>
    </Tag>
  );
}
