// Generic content-area Suspense fallback for (app) — a neutral fallback for any
// top-level route that doesn't define its own loading.tsx. Every real section
// now owns a nearer boundary that keeps its chrome in place: Home →
// (home)/loading.tsx (no tabs); the tabbed sections (Cameras/Agents/Streams via
// (fleet), Event Outputs, Dev Settings, Account) each have a group loading.tsx
// that sits BELOW the section's persistent SectionTabs, so only the content
// reloads. Hence no tab strip here — those are never blown away anymore.
//
// Renders inside the persistent (app) shell (sidebar/topbar stay put). Also: a
// `loading` boundary is what lets Next 16 partial-prefetch these dynamic routes
// on <Link> hover. The sibling dashboard/loading.tsx covers the first-load case
// where the (app) layout itself hasn't rendered yet.
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
