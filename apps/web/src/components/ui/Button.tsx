import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.12)] active:shadow-none",
  secondary: "bg-raised text-ink hairline hover:bg-surface hover:shadow-[inset_0_0_0_1px_var(--line-strong)]",
  quiet: "text-ink-2 hover:text-ink hover:bg-sunken",
  danger: "bg-raised text-act hairline hover:bg-act-soft",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-2.5 text-small gap-1.5",
  md: "h-9 px-3.5 text-body gap-2",
};

interface Common {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export function buttonClass({ variant = "secondary", size = "md", className }: Omit<Common, "children">) {
  return cn(
    "press inline-flex items-center justify-center rounded-md font-medium select-none whitespace-nowrap",
    "disabled:pointer-events-none disabled:opacity-45",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({ variant, size, className, children, ...rest }: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClass({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, children, href, ...rest }: Common & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}
