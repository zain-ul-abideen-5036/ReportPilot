/**
 * Skeleton shaped like a page header and a list, so nothing jumps when
 * the real content lands. A shimmer would be decoration; a still block is enough.
 */
export default function Loading() {
  return (
    <div className="pt-[calc(3.5rem+2.5rem)]" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-32 rounded-xs bg-sunken" />
      <div className="mt-4 h-9 w-80 max-w-full rounded-sm bg-sunken" />
      <div className="mt-3 h-4 w-[34rem] max-w-full rounded-xs bg-sunken/80" />
      <div className="mt-12 flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line py-3">
            <div className="size-8 rounded-md bg-sunken" />
            <div className="flex-1">
              <div className="h-3.5 w-48 rounded-xs bg-sunken" />
              <div className="mt-2 h-3 w-72 max-w-full rounded-xs bg-sunken/70" />
            </div>
          </div>
        ))}
      </div>
      <div className="fixed inset-x-0 top-0 z-(--z-toast) h-0.5 overflow-hidden">
        <div className="h-full w-1/4 animate-indeterminate bg-accent" />
      </div>
    </div>
  );
}
