export type DotStatus = "green" | "yellow" | "orange" | "red" | "neutral";

// Figma status indicator (the small filled circle by each tile title). Colors
// are the redesign's status-accent system (see --dn-* in theme.css): green
// healthy, yellow info, orange needs-review/warning, red critical/offline,
// neutral idle. A plain filled dot — no ring/halo. Hex kept literal for callers
// (STATUS_HEX) that need the raw value.
const COLOR: Record<DotStatus, string> = {
  green: "#48c84a",
  yellow: "#ffe957",
  orange: "#ff8f57",
  red: "#f94b4b",
  neutral: "#9aa39a",
};

export function StatusDot({ status }: { status: DotStatus }) {
  const color = COLOR[status];
  return (
    <span
      aria-hidden
      className="inline-block rounded-full shrink-0"
      style={{
        width: "clamp(10px, 1vw, 15px)",
        height: "clamp(10px, 1vw, 15px)",
        background: color,
      }}
    />
  );
}

// Literal hexes for callers that need the raw value (SVG fills, charts).
export const STATUS_HEX = COLOR;
