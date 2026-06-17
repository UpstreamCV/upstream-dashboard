export default function Loading() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label="Loading">
      {/* Hero stream + status rail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <div className="dn-tile h-[clamp(260px,34vw,520px)] animate-pulse" />
        </div>
        <div className="space-y-4 md:space-y-6">
          <div className="dn-tile h-40 animate-pulse" />
          <div className="dn-tile h-40 animate-pulse" />
          <div className="dn-tile h-40 animate-pulse" />
        </div>
      </div>

      {/* Condensed meta details row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="dn-tile h-44 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
