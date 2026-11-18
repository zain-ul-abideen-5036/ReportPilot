import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Editorial photo treatment: a gentle warm grade so stock photos sit in the
 * paper palette, a pine-to-brass wash at the foot, and a caption set like a
 * magazine credit rather than an overlay.
 */
export function Photo({
  src, alt, caption, index, className, ratio = "aspect-[4/5]", priority = false, sizes = "(min-width: 1024px) 40vw, 100vw",
}: {
  src: string;
  alt: string;
  caption?: string;
  index?: string;
  className?: string;
  ratio?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <figure className={cn("group", className)}>
      <div className={cn("relative overflow-hidden rounded-[6px] bg-sunken shadow-sheet", ratio)}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-[1200ms] ease-(--ease-standard) [filter:sepia(0.18)_saturate(0.82)_contrast(1.03)] group-hover:scale-[1.03]"
        />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgb(26_68_55/0.28)_100%)] mix-blend-multiply" />
        <div aria-hidden className="absolute inset-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]" />
      </div>
      {caption && (
        <figcaption className="mt-3 flex gap-3 text-small text-ink-3">
          {index && <span className="font-display text-ink-4 italic">{index}</span>}
          <span className="max-w-[40ch]">{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}
