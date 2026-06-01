// Suspense fallback for camera-detail tab navigation (Monitor / Observations /
// Configure / Settings / Reliability). It renders inside the [cameraId] layout,
// so the camera header + tab strip persist and only the tab content swaps to
// this skeleton — switching tabs shows immediate feedback and streams the tab
// in, instead of blocking on the tab page's server fetches with the old tab
// still on screen. (The camera-tabs component always intended this — "loading
// boundaries scope per tab" — but the file was never added.)
//
// Also enables <Link> partial-prefetch of the tab routes (Next 16 prefetches a
// dynamic route only when it has a loading boundary), so hovering a tab warms
// it. Layout roughly mirrors the Monitor tab (the heaviest one): a two-column
// stream/frame row, a full-width overlay strip, and the meta-panel grid.
export default function Loading() {
  return (
    <div
      className="space-y-4 md:space-y-6"
      aria-busy="true"
      aria-label="Loading camera"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="dn-tile h-[clamp(220px,30vw,420px)] animate-pulse" />
        <div className="dn-tile h-[clamp(220px,30vw,420px)] animate-pulse" />
      </div>

      <div className="dn-tile h-[clamp(180px,24vw,340px)] animate-pulse" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dn-tile h-28 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
