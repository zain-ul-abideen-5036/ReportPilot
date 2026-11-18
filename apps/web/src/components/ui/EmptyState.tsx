import { cn } from "@/lib/cn";

/** Says what is missing, why it matters and what to do. Bounded to a paragraph's width. */
export function EmptyState({ icon, title, children, action, className }: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-[44ch] flex-col items-center py-10 text-center", className)}>
      {icon && <div className="mb-3 text-ink-4">{icon}</div>}
      <p className="text-body font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 text-small text-ink-3">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
