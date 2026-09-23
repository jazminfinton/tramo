/**
 * A placeholder with the shape of what's loading (as in Fragua): same frames
 * and sizes as the real content, so nothing jumps when it arrives. It pulses,
 * unless motion is reduced, and follows every theme through `ink`.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  // A shape passed in (rounded-full) replaces the default instead of fighting it.
  const shape = /\brounded-/.test(className) ? "" : "rounded-tile";
  return <div aria-hidden className={`animate-pulse bg-ink/10 motion-reduce:animate-none ${shape} ${className}`} />;
}

/** The status line every loading screen carries, so screen readers hear it too. */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}

/** A list in a panel, one placeholder per row: a dot, two lines and a value. */
export function SkeletonList({ rows }: { rows: number }) {
  return (
    <div aria-hidden className="panel grain flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3 not-first:hairline-t">
          <Skeleton className="size-2.5 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
