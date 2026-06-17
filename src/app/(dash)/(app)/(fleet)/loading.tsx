// Loading boundary INSIDE the (fleet) group, so the layout's Cameras / Agents /
// Active Streams strip persists and only the content reloads. No strip here —
// it's provided by the persistent layout. Shaped for the list pages (a stat row
// over a card grid); also serves the agent/session detail pages.
export default function Loading() {
  return (
    <div
      className="space-y-5 md:space-y-6"
      aria-busy="true"
      aria-label="Loading"
    >
      {/* page header (eyebrow + title) */}
      <div className="space-y-2">
        <div className="h-3 w-20 rounded-full bg-white/10 animate-pulse" />
        <div className="h-9 w-48 rounded-lg bg-white/15 animate-pulse" />
      </div>

      {/* stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dn-tile h-20 animate-pulse" />
        ))}
      </div>

      {/* card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="dn-tile h-[clamp(160px,20vw,260px)] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
