// Content-only loading skeleton for the tabbed section pages (Account, Event
// Outputs, Dev Settings). Each of those route groups has a layout.tsx that
// renders the SectionTabs strip; placing a loading.tsx (that renders THIS) in
// the group puts the suspense boundary BELOW the layout, so the real tab strip
// PERSISTS across tab navigation and only this content area swaps while the next
// page's data loads. Hence — unlike the top-level (app)/loading.tsx — there's no
// tab strip here. Mirrors the camera-detail loading.tsx pattern.
export function SectionContentSkeleton() {
  return (
    <div
      className="space-y-4 md:space-y-6"
      aria-busy="true"
      aria-label="Loading"
    >
      {/* page header (eyebrow + title) */}
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="h-8 w-48 rounded-lg bg-white/15 animate-pulse" />
      </div>
      <div className="dn-tile h-[clamp(200px,28vw,360px)] animate-pulse" />
      <div className="dn-tile h-[clamp(140px,18vw,220px)] animate-pulse" />
    </div>
  );
}
