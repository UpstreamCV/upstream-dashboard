import Image from "next/image";
import { Search } from "lucide-react";

// Figma DashboardHome top bar — sits directly on the creek gradient (no panel).
// Left: avatar + "Welcome back, {name}". Right: search + "Upstream Dashboard"
// + the white Upstream mark. Server Component (display-only); auth comes from
// the (app) layout which passes `name` down.
export function TopbarNext({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="flex items-center justify-between gap-4 px-1 sm:px-3 py-1">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <span
          className="grid place-items-center rounded-full bg-white/90 text-[var(--dn-creek-deep)] font-bold shrink-0"
          style={{
            width: "clamp(40px,4.4vw,64px)",
            height: "clamp(40px,4.4vw,64px)",
            fontSize: "clamp(1rem,1.6vw,1.5rem)",
          }}
          aria-hidden
        >
          {initial}
        </span>
        <h1 className="truncate text-white font-bold text-[clamp(1.15rem,2.2vw,2rem)]">
          Welcome back, <span className="capitalize">{name}</span>
        </h1>
      </div>

      <div className="hidden sm:flex items-center gap-3 sm:gap-4 shrink-0">
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
        <span className="text-white/65 font-bold text-[clamp(1.05rem,2vw,1.85rem)] whitespace-nowrap">
          Upstream Dashboard
        </span>
        <Image
          src="/dashboard/upstream-logo.png"
          alt="Upstream"
          width={64}
          height={64}
          priority
          className="object-contain opacity-65"
          style={{
            width: "clamp(40px,4.4vw,64px)",
            height: "clamp(40px,4.4vw,64px)",
          }}
        />
      </div>
    </header>
  );
}
