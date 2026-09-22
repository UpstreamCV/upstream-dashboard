import Image from "next/image";
import { Search } from "lucide-react";

// The top-RIGHT tools cluster of the dashboard header: search + "Upstream
// Dashboard" wordmark + logo. On Home these render at the top-right INSIDE the
// content panel, so the panel's background runs behind them (the box "goes
// over" this area). The user identity (avatar + greeting) lives separately at
// the top of the left rail. Server Component (display-only); the search input
// is presentational until search lands.
//
// The demo notification bell used to sit here. It was scene machinery aimed at
// a guided walkthrough, and in an embedded demo it reads as a real product
// control that does nothing, so it is gone along with the `demoScene` prop the
// layout used to pass for it.
//
// (Was `TopbarNext`, a full-width bar with identity on the left + tools on the
// right; identity moved to the rail, so this is now tools-only.)
export function TopbarTools() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
      <div className="hidden sm:flex items-center gap-3 sm:gap-4">
        {/* Presentational — search isn't wired yet. WIRE-UP: lift to a client
            component with state + a results action when search lands. */}
        <div className="dn-glow-soft relative rounded-full">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-white/75"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search"
            placeholder="Search…"
            className="dn-field relative z-[1] py-2 pl-9 pr-4 text-[clamp(0.85rem,1vw,1rem)]"
            style={{ width: "clamp(150px,18vw,260px)" }}
          />
        </div>
        <span className="text-white/80 font-bold text-[clamp(1.05rem,2vw,1.85rem)] whitespace-nowrap">
          Upstream Dashboard
        </span>
        <Image
          src="/upstream-logo.png"
          alt="Upstream"
          width={64}
          height={64}
          priority
          className="object-contain opacity-85"
          style={{
            width: "clamp(40px,4.4vw,64px)",
            height: "clamp(40px,4.4vw,64px)",
          }}
        />
      </div>
    </div>
  );
}
