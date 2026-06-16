import {
  formatAppliedGeometryStatus,
  type AppliedGeometryDisplay,
} from "@/lib/perception/applied-geometry-format";
import { Row } from "./camera-panels";
import { StatusDot, type DotStatus } from "./status-dot";
import type { ProcessorStatusRecord } from "@/lib/api/types";

// Monitor-tab Applied Geometry panel (P6-D follow-up). Surfaces the lineage
// block the P6-C analytics worker stamps onto every processor status post:
// did the processor actually pick up the operator's saved geometry, or is
// it still running probe defaults / a degraded fallback?
//
// Server Component — matches CameraMetaPanel / AgentPanel / ValidationPanel.
// Processor status changes on lifecycle / restart, not per frame; the chip
// is intentionally non-polling. Operators reload the tab after a save + a
// session restart and read the verdict.
//
// Copy never mentions DeepStream / nvdsanalytics / GStreamer — this is an
// operator surface, not a runtime-internal one.

const HEADER_DOT: Record<AppliedGeometryDisplay["kind"], DotStatus> = {
  operator_saved: "green",
  default: "yellow",
  fallback: "yellow",
  geometry_invalid: "red",
  no_status: "neutral",
  missing_applied_geometry: "neutral",
  unknown_source: "yellow",
};

// Hex tokens come from the design vocabulary already in use by the sibling
// panels (CameraStreamStatusBadgeNext, AgentPanel, ValidationPanel). Kept
// inline to match — there's no shared semantic-color module yet.
const HEADER_TEXT: Record<AppliedGeometryDisplay["kind"], string> = {
  operator_saved: "#3f7d4e",
  default: "#8a6d1f",
  fallback: "#8a6d1f",
  geometry_invalid: "#c0473b",
  no_status: "var(--dn-text-50)",
  missing_applied_geometry: "var(--dn-text-50)",
  unknown_source: "#8a6d1f",
};

const HEADER_LABEL: Record<AppliedGeometryDisplay["kind"], string> = {
  operator_saved: "Operator-saved",
  default: "Default",
  fallback: "Fallback default",
  geometry_invalid: "Geometry error",
  no_status: "Not reported yet",
  missing_applied_geometry: "Unknown",
  unknown_source: "Unrecognized",
};

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[#8a6d1f]">
      {children}
    </p>
  );
}

function Danger({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[#c0473b]">
      {children}
    </p>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
      {children}
    </p>
  );
}

function PanelBody({ display }: { display: AppliedGeometryDisplay }) {
  switch (display.kind) {
    case "operator_saved":
      return (
        <>
          <Row
            label="Revision"
            value={
              <span className="font-mono text-white">r{display.revision}</span>
            }
          />
          <Row
            label="Lines"
            value={
              <span className="font-mono text-[var(--dn-text-50)]">
                {display.lineCount}
              </span>
            }
          />
          <Row
            label="ROIs"
            value={
              <span className="font-mono text-[var(--dn-text-50)]">
                {display.roiCount}
              </span>
            }
          />
        </>
      );

    case "default":
      return (
        <>
          <Row
            label="Lines"
            value={
              <span className="font-mono text-[var(--dn-text-50)]">
                {display.lineCount}
              </span>
            }
          />
          <Row
            label="ROIs"
            value={
              <span className="font-mono text-[var(--dn-text-50)]">
                {display.roiCount}
              </span>
            }
          />
          <Warning>
            Using default detection zones. Draw and save a counting line in
            Configure to apply your own.
          </Warning>
        </>
      );

    case "fallback":
      return (
        <>
          {display.revision !== null ? (
            <Row
              label="Saved revision"
              value={
                <span className="font-mono text-[var(--dn-text-50)]">
                  r{display.revision}
                </span>
              }
            />
          ) : null}
          <Warning>
            Saved geometry failed validation. Processor fell back to defaults.
          </Warning>
          {display.errorReason ? (
            <p className="mt-2 text-[clamp(0.75rem,0.85vw,0.82rem)] font-mono text-[var(--dn-text-50)]">
              {display.errorReason}
            </p>
          ) : null}
        </>
      );

    case "geometry_invalid":
      return (
        <>
          <Danger>
            Saved geometry failed validation. Processor fell back to defaults.
          </Danger>
          {display.errorMessage ? (
            <p className="mt-2 text-[clamp(0.75rem,0.85vw,0.82rem)] font-mono text-[var(--dn-text-50)]">
              {display.errorMessage}
            </p>
          ) : null}
        </>
      );

    case "no_status":
      return (
        <Muted>Start a processor session to see applied geometry.</Muted>
      );

    case "missing_applied_geometry":
      return (
        <Muted>
          Latest processor status does not include geometry lineage.
        </Muted>
      );

    case "unknown_source":
      return (
        <Warning>
          Unrecognized geometry source. Dashboard may need an update.
        </Warning>
      );
  }
}

export function AppliedGeometryPanel({
  status,
}: {
  status: ProcessorStatusRecord | null;
}) {
  const display = formatAppliedGeometryStatus(status);
  const label =
    display.kind === "unknown_source" ? display.sourceLabel : HEADER_LABEL[display.kind];

  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          applied geometry
        </p>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={HEADER_DOT[display.kind]} />
          <span
            className="font-bold"
            style={{ color: HEADER_TEXT[display.kind] }}
          >
            {label}
          </span>
        </span>
      </div>
      <PanelBody display={display} />
    </div>
  );
}
