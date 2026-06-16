// Content-area Suspense fallback for top-level dashboard navigations (Home,
// Cameras, Agents, Stream sessions, Settings, API tokens). It renders inside
// the persistent (app) shell — the sidebar/topbar stay put and only the <main>
// content swaps to this skeleton — so a route transition shows immediate
// feedback instead of freezing on the old page until the server responds.
//
// Just as important: every / route is dynamic, and Next 16 only
// prefetches a dynamic route when a `loading` boundary exists for it. Adding
// this boundary lets <Link> partial-prefetch the shell on hover/viewport, so
// the skeleton is usually already warm by the time the user clicks.
//
// Content-only on purpose (no ShellBackdrop / dvh wrapper — those belong to the
// shell, which persists). The sibling dashboard/loading.tsx covers the
// first-load case where the (app) layout itself hasn't rendered yet.
export default function Loading() {
  return (
    <section
      className="space-y-5 md:space-y-6"
      aria-busy="true"
      aria-label="Loading"
    >
      {/* page header (eyebrow + title) */}
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="h-9 w-56 rounded-lg bg-white/15 animate-pulse" />
      </div>

      {/* stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dn-tile h-20 animate-pulse" />
        ))}
      </div>

      {/* content tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="dn-tile h-[clamp(160px,20vw,260px)] animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
