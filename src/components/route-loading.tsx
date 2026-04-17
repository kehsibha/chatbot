/**
 * Lightweight skeleton for route-level `loading.tsx` — instant feedback on nav.
 */
export function RouteLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6" aria-busy="true" aria-label="Loading">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-md bg-[var(--color-panel-2)]" />
      <div className="space-y-3">
        <div className="h-14 animate-pulse rounded-md bg-[var(--color-panel-2)]" />
        <div className="h-14 animate-pulse rounded-md bg-[var(--color-panel-2)]" />
        <div className="h-14 w-4/5 animate-pulse rounded-md bg-[var(--color-panel-2)]" />
      </div>
    </div>
  );
}
