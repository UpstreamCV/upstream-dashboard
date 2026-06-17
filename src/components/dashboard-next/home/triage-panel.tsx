import Link from "next/link";
import {
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  Video,
} from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import type { Alert } from "@/lib/api/types";
import { severityMeta } from "../dn-status";

// Triage panel (Figma "Some Issues" 390:341 — left middle card, "Triage
// Section" rows + "Group 19" banner). Lists the OPEN alerts the operator needs
// to act on. Each row leads with a CAMERA SNAPSHOT (severity-bordered + a soft
// same-color glow), then the severity chip, title + live time, the alert
// message, and a camera • location meta line; the Review button sits at the far
// right. Below the rows a separate reassurance banner explains that only
// attention-worthy issues are shown.
//
// Honest-data note: there is no fleet-level snapshot endpoint (same constraint
// the cameras grid lives under — see camera-card.tsx), so the snapshot slot is
// an image-icon placeholder unless a still is supplied (demo passes the dock
// frame). Camera name + location are resolved from the cameras list upstream
// and omitted entirely when unknown — never a raw UUID or a fake "—".
//
// When nothing is open the panel flips to the "All Good" empty state: a
// bright-green-bordered card with a shield, headline, and a "View History" pill.
//
// Alerts carry a freeform `severity` string; severityMeta() maps it to the
// redesign's chip fill/text + accent. RelativeTime keeps the timestamp live
// (never a Date.now() snapshot baked at render). Every link points at /alerts.

const ALERTS_HREF = "/alerts";

/** An open alert enriched with its camera's display name + location (resolved
 *  upstream from the cameras list) and an optional snapshot still. */
export interface TriageItem {
  alert: Alert;
  cameraName: string | null;
  location: string | null;
  /** Snapshot still for the thumbnail slot (demo supplies the dock frame). */
  previewSrc?: string;
}

function TriageRow({ item }: { item: TriageItem }) {
  const { alert, cameraName, location, previewSrc } = item;
  const sev = severityMeta(alert.severity);
  // Figma 390:493: a translucent-WHITE rim with the severity color showing only
  // as a near-solid same-color halo (shadow 0 0 25px <accent>).
  const glow = `color-mix(in srgb, ${sev.accentVar} 90%, transparent)`;

  return (
    <li className="flex items-center gap-[clamp(0.85rem,1.6vw,1.4rem)] py-[clamp(0.9rem,1.6vw,1.4rem)]">
      {/* Camera snapshot — severity-bordered + glowing; image-icon placeholder
          when no still is available. */}
      <div
        className="relative grid shrink-0 place-items-center overflow-hidden bg-[rgba(255,255,255,0.06)] bg-cover bg-center aspect-[16/10] w-[clamp(6rem,13vw,9.75rem)]"
        style={{
          border: "2px solid var(--dn-text-40)",
          borderRadius: "var(--dn-radius-inner)",
          boxShadow: `0 0 clamp(16px,2vw,25px) ${glow}`,
          ...(previewSrc ? { backgroundImage: `url(${previewSrc})` } : {}),
        }}
      >
        {previewSrc ? null : (
          <ImageIcon
            className="h-[clamp(1.4rem,2.4vw,2.2rem)] w-[clamp(1.4rem,2.4vw,2.2rem)] text-white/35"
            strokeWidth={1.75}
            aria-hidden
          />
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-[clamp(0.3rem,0.6vw,0.5rem)]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span
            className="shrink-0 rounded-[var(--dn-radius-inner)] px-3 py-1 text-[clamp(0.72rem,0.9vw,0.85rem)] font-bold"
            style={{ background: sev.chipBg, color: sev.chipText }}
          >
            {sev.chipLabel}
          </span>
          <span className="min-w-0 truncate font-bold text-[clamp(0.95rem,1.2vw,1.15rem)]">
            {alert.title}
          </span>
          <span className="shrink-0 text-[clamp(0.8rem,1vw,0.95rem)] text-[var(--dn-text-40)]">
            • <RelativeTime value={alert.created_at} />
          </span>
        </div>

        {alert.message && (
          <p className="line-clamp-2 text-[clamp(0.82rem,1.05vw,1rem)] text-[var(--dn-text-40)]">
            {alert.message}
          </p>
        )}

        {(cameraName || location) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[clamp(0.78rem,0.98vw,0.92rem)] font-bold text-[var(--dn-text-40)]">
            {cameraName && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Video className="h-[1em] w-[1.15em] shrink-0" aria-hidden />
                <span className="truncate">{cameraName}</span>
              </span>
            )}
            {cameraName && location && (
              <span
                className="h-1 w-1 shrink-0 rounded-full bg-[var(--dn-text-40)]"
                aria-hidden
              />
            )}
            {location && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-[1em] w-[1em] shrink-0" aria-hidden />
                <span className="truncate">{location}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <Link
        href={ALERTS_HREF}
        className="dn-btn dn-glow-soft shrink-0 self-center font-bold px-[clamp(0.95rem,1.4vw,1.3rem)] py-[clamp(0.45rem,0.75vw,0.65rem)] text-[clamp(0.78rem,0.95vw,0.9rem)]"
      >
        <span className="relative z-10">Review</span>
      </Link>
    </li>
  );
}

// "We're only showing what needs your attention" reassurance banner — a
// separate green-bordered element below the rows (Figma "Group 19").
function TriageBanner() {
  return (
    <div
      className="flex items-center gap-[clamp(0.75rem,1.4vw,1.25rem)] px-[clamp(1rem,1.8vw,1.75rem)] py-[clamp(0.75rem,1.3vw,1.15rem)]"
      style={{
        background: "var(--dn-text-15)",
        border:
          "2px solid color-mix(in srgb, var(--dn-green-bright) 50%, transparent)",
        borderRadius: "var(--dn-radius-tile)",
      }}
    >
      <ShieldCheck
        className="h-[clamp(1.6rem,2.6vw,2.4rem)] w-[clamp(1.6rem,2.6vw,2.4rem)] shrink-0"
        style={{ color: "var(--dn-green-bright)" }}
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-bold text-[clamp(0.9rem,1.15vw,1.1rem)] text-white">
          We&rsquo;re only showing what needs your attention.
        </p>
        <p className="font-bold text-[clamp(0.78rem,1vw,0.95rem)] text-[var(--dn-text-40)]">
          Other issues have been automatically fixed by us.
        </p>
      </div>
    </div>
  );
}

function TriageEmpty() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-[clamp(2rem,5vw,4rem)] text-center"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "2px solid color-mix(in srgb, var(--dn-green-bright) 50%, transparent)",
        borderRadius: "var(--dn-radius-tile)",
      }}
    >
      <ShieldCheck
        className="h-[clamp(2.75rem,5vw,4rem)] w-[clamp(2.75rem,5vw,4rem)]"
        style={{ color: "var(--dn-green-bright)" }}
        strokeWidth={1.75}
        aria-hidden
      />
      <h3 className="font-bold text-[clamp(1.2rem,2.2vw,1.65rem)]">
        No current issues with your pipeline!
      </h3>
      <p className="text-[clamp(0.85rem,1.1vw,1rem)] text-[var(--dn-text-40)]">
        All issues have been resolved
      </p>
      <Link
        href={ALERTS_HREF}
        className="dn-btn dn-glow-soft mt-1 font-bold px-[clamp(1rem,1.4vw,1.3rem)] py-[clamp(0.45rem,0.75vw,0.65rem)] text-[clamp(0.82rem,1vw,0.95rem)]"
      >
        <span className="relative z-10">View History</span>
      </Link>
    </div>
  );
}

export function TriagePanel({
  items,
  moreCount = 0,
}: {
  items: TriageItem[];
  // Open alerts beyond the few shown here — surfaces a "View more" button.
  moreCount?: number;
}) {
  return (
    <section className="dn-tile flex flex-col gap-[clamp(0.75rem,1.4vw,1.25rem)] p-[clamp(1.25rem,2.2vw,2.25rem)] min-w-0">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          Triage
          <span className="ml-2 font-bold text-[clamp(0.85rem,1.1vw,1.05rem)] text-[var(--dn-text-50)]">
            — What needs your attention
          </span>
        </h2>
        <Link
          href={ALERTS_HREF}
          className="font-bold text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-70)] hover:text-[var(--dn-text)] shrink-0"
        >
          View all
        </Link>
      </header>

      {items.length === 0 ? (
        <TriageEmpty />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-[var(--dn-text-15)]">
            {items.map((item) => (
              <TriageRow key={item.alert.id} item={item} />
            ))}
          </ul>
          {moreCount > 0 && (
            <Link
              href={ALERTS_HREF}
              className="dn-btn dn-glow-soft self-stretch text-center font-bold px-[clamp(0.95rem,1.4vw,1.3rem)] py-[clamp(0.5rem,0.85vw,0.7rem)] text-[clamp(0.8rem,1vw,0.92rem)]"
            >
              <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
                View {moreCount} more
                <ChevronRight
                  className="h-[1.05em] w-[1.05em] shrink-0"
                  aria-hidden
                />
              </span>
            </Link>
          )}
          <TriageBanner />
        </>
      )}
    </section>
  );
}
