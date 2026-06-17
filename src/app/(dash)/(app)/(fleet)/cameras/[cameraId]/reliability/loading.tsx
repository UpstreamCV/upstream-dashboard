export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-6 p-[clamp(0.5rem,1vw,1rem)]"
    >
      {/* Verdict hero */}
      <div className="dn-tile h-[clamp(160px,20vw,240px)] animate-pulse" />

      {/* Confidence trend card */}
      <div className="dn-tile h-56 animate-pulse" />

      {/* By-config trend card */}
      <div className="dn-tile h-56 animate-pulse" />

      {/* Config comparison card */}
      <div className="dn-tile h-40 animate-pulse" />

      {/* Findings section */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="h-5 w-32 rounded bg-white/15 animate-pulse" />
          <div className="h-3 w-16 rounded-full bg-white/10 animate-pulse" />
        </div>
        <div className="dn-tile h-40 animate-pulse" />
        <div className="dn-tile h-40 animate-pulse" />
      </div>
    </div>
  );
}
